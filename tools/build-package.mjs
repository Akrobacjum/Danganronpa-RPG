/**
 * module.zip, the same bytes from the same commit on any machine's git config (E26 prep, 14.11.2026).
 * ---------------------------------------------------------------------------
 *     node tools/build-package.mjs [out.zip]   build module.zip (default) from HEAD; prints its sha256 and file count
 *
 * Until E26 prep release.yml built the package with `git archive --format=zip -o module.zip HEAD`. git archive runs the text
 * conversions of the machine it runs on: measured on 14.11.2026 at c31d9b0d with git 2.43.0, the plain command gave
 * the same bytes twice (sha256 0c4df303...), and with `-c core.autocrlf=true` other bytes (3a10c1ba...), every text
 * file of the zip with CRLF line ends - so a zip built on a Windows checkout's config is not the release's. This pins
 * the conversions off (`core.autocrlf=false`, `core.eol=lf`), and nothing else differs from release.yml's command.
 * `node tools/check.mjs package` builds it under a Windows config and under none and fails when the bytes differ.
 * What it does not hold: the same bytes from another git version (zip's deflate is git's and zlib's; not measured).
 * release.yml's own step carries the same two options since E26 prep (the coordinator, 14.11.2026: the workflow is not
 * switched to this file in 1.3.0's release, a workflow change being hard to test there); `check package` holds them.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
export const PINNED = ["-c", "core.autocrlf=false", "-c", "core.eol=lf"];

/** The zip (or `format`) of `rev` as a Buffer, built with the conversions pinned; `config` is extra `-c` pairs placed before them. */
export function buildZip(rev = "HEAD", config = [], repo = REPO, format = "zip") {
    return execFileSync("git", ["-C", repo, ...config, ...PINNED, "archive", `--format=${format}`, rev], { maxBuffer: 512 * 1024 * 1024 });
}

export const sha256 = buf => crypto.createHash("sha256").update(buf).digest("hex");

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const out = path.resolve(process.argv[2] ?? "module.zip");
    const zip = buildZip();
    fs.writeFileSync(out, zip);
    console.log(`build-package: ${path.relative(process.cwd(), out) || out} from ${execFileSync("git", ["-C", REPO, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim()}, `
        + `${zip.length} bytes, sha256 ${sha256(zip)}`);
}
