import assert from "node:assert/strict";
import { constants } from "node:fs";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  open,
  realpath,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  MAX_RETRIEVE_FILE_BYTES,
  RetrieveFileValidationError,
  formatRetrieveFileSize,
  resolveRetrieveFile,
  type RetrieveFileErrorCode
} from "./retrieve-file-policy.js";

interface RetrieveFixture {
  root: string;
  home: string;
  project: string;
  externalFile: string;
  cleanup(): Promise<void>;
}

async function createFixture(): Promise<RetrieveFixture> {
  const root = await mkdtemp(join(tmpdir(), "retrieve-file-policy-"));
  const home = join(root, "home");
  const project = join(root, "project");
  const reports = join(project, "reports");
  const externalFile = join(home, "outside.html");
  await mkdir(reports, { recursive: true });
  await mkdir(home, { recursive: true });
  await writeFile(join(reports, "audit.html"), "audit");
  await writeFile(join(reports, "audit report.html"), "spaced audit");
  await writeFile(externalFile, "outside");
  return {
    root,
    home,
    project,
    externalFile,
    cleanup: async () => rm(root, { recursive: true, force: true })
  };
}

async function expectValidationError(
  operation: () => Promise<unknown>,
  code: RetrieveFileErrorCode
): Promise<RetrieveFileValidationError> {
  try {
    await operation();
  } catch (error) {
    assert.ok(error instanceof RetrieveFileValidationError);
    assert.equal(error.code, code);
    assert.match(error.message, /[\u3400-\u9fff]/u);
    return error;
  }
  assert.fail(`expected ${code}`);
}

test("resolves relative, matching outer-quoted, home, and absolute paths", async () => {
  const fixture = await createFixture();
  try {
    const relativeFile = await resolveRetrieveFile({
      rawPath: "reports/audit.html",
      projectPath: fixture.project,
      homeDir: fixture.home
    });
    const quotedFile = await resolveRetrieveFile({
      rawPath: "  'reports/audit report.html'  ",
      projectPath: fixture.project,
      homeDir: fixture.home
    });
    const homeFile = await resolveRetrieveFile({
      rawPath: "~/outside.html",
      projectPath: fixture.project,
      homeDir: fixture.home
    });
    const absoluteFile = await resolveRetrieveFile({
      rawPath: fixture.externalFile,
      projectPath: fixture.project,
      homeDir: fixture.home
    });

    assert.equal(relativeFile.insideProject, true);
    assert.equal(relativeFile.displayPath, join("reports", "audit.html"));
    assert.equal(relativeFile.requestedPath, "reports/audit.html");
    assert.equal(quotedFile.fileName, "audit report.html");
    assert.equal(quotedFile.requestedPath, "reports/audit report.html");
    assert.equal(homeFile.insideProject, false);
    assert.equal(homeFile.targetRealPath, await realpath(fixture.externalFile));
    assert.equal(homeFile.displayPath, await realpath(fixture.externalFile));
    assert.equal(absoluteFile.insideProject, false);
    assert.equal(absoluteFile.targetRealPath, await realpath(fixture.externalFile));
  } finally {
    await fixture.cleanup();
  }
});

test("treats a symlink escaping the project as external", async () => {
  const fixture = await createFixture();
  try {
    const linkPath = join(fixture.project, "reports", "external-link.html");
    await symlink(fixture.externalFile, linkPath);

    const resolved = await resolveRetrieveFile({
      rawPath: "reports/external-link.html",
      projectPath: fixture.project,
      homeDir: fixture.home
    });

    assert.equal(resolved.insideProject, false);
    assert.equal(resolved.targetRealPath, await realpath(fixture.externalFile));
    assert.equal(resolved.displayPath, await realpath(fixture.externalFile));
  } finally {
    await fixture.cleanup();
  }
});

test("rejects an empty path", async () => {
  const fixture = await createFixture();
  try {
    await expectValidationError(
      () => resolveRetrieveFile({ rawPath: "  ", projectPath: fixture.project, homeDir: fixture.home }),
      "empty_path"
    );
  } finally {
    await fixture.cleanup();
  }
});

test("rejects a missing project", async () => {
  const fixture = await createFixture();
  try {
    await expectValidationError(
      () => resolveRetrieveFile({
        rawPath: "reports/audit.html",
        projectPath: join(fixture.root, "missing-project"),
        homeDir: fixture.home
      }),
      "project_not_found"
    );
  } finally {
    await fixture.cleanup();
  }
});

test("rejects a missing target", async () => {
  const fixture = await createFixture();
  try {
    await expectValidationError(
      () => resolveRetrieveFile({ rawPath: "missing.txt", projectPath: fixture.project, homeDir: fixture.home }),
      "not_found"
    );
  } finally {
    await fixture.cleanup();
  }
});

test("rejects a directory", async () => {
  const fixture = await createFixture();
  try {
    await expectValidationError(
      () => resolveRetrieveFile({ rawPath: "reports", projectPath: fixture.project, homeDir: fixture.home }),
      "not_regular_file"
    );
  } finally {
    await fixture.cleanup();
  }
});

test("rejects a FIFO where supported", async (t) => {
  const fixture = await createFixture();
  try {
    const fifoPath = join(fixture.project, "reports", "events.fifo");
    const result = spawnSync("mkfifo", [fifoPath], { encoding: "utf8" });
    if (result.error || result.status !== 0) {
      t.skip("mkfifo is not supported in this environment");
      return;
    }

    await expectValidationError(
      () => resolveRetrieveFile({ rawPath: "reports/events.fifo", projectPath: fixture.project, homeDir: fixture.home }),
      "not_regular_file"
    );
  } finally {
    await fixture.cleanup();
  }
});

test("rejects an unreadable file where permissions are meaningful", async (t) => {
  const fixture = await createFixture();
  const unreadablePath = join(fixture.project, "reports", "unreadable.txt");
  try {
    await writeFile(unreadablePath, "secret");
    await chmod(unreadablePath, 0o000);
    try {
      await access(unreadablePath, constants.R_OK);
      t.skip("current user bypasses file read permission checks");
      return;
    } catch {
      // Permission checks are effective in this environment.
    }

    await expectValidationError(
      () => resolveRetrieveFile({ rawPath: "reports/unreadable.txt", projectPath: fixture.project, homeDir: fixture.home }),
      "unreadable"
    );
  } finally {
    await chmod(unreadablePath, 0o600).catch(() => undefined);
    await fixture.cleanup();
  }
});

test("rejects a sparse file larger than 50 MiB and reports its actual size", async () => {
  const fixture = await createFixture();
  const oversizedPath = join(fixture.project, "reports", "oversized.bin");
  try {
    const handle = await open(oversizedPath, "w");
    try {
      await handle.truncate(MAX_RETRIEVE_FILE_BYTES + 1);
    } finally {
      await handle.close();
    }

    const error = await expectValidationError(
      () => resolveRetrieveFile({ rawPath: oversizedPath, projectPath: fixture.project, homeDir: fixture.home }),
      "too_large"
    );
    assert.equal(error.sizeBytes, MAX_RETRIEVE_FILE_BYTES + 1);
    assert.match(error.message, /50\.0 MiB/u);
  } finally {
    await fixture.cleanup();
  }
});

test("formats retrieve file sizes using binary units", () => {
  assert.equal(formatRetrieveFileSize(512), "512 B");
  assert.equal(formatRetrieveFileSize(1536), "1.5 KiB");
  assert.equal(formatRetrieveFileSize(5 * 1024 * 1024), "5.0 MiB");
});
