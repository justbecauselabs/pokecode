#!/usr/bin/env bun

type CliOptions = {
  args: string[];
};

type NormalizedOptions = {
  semver: string;
  githubOutputPath: string;
  shouldUpdatePackage: boolean;
};

const parseOptions = (params: CliOptions): NormalizedOptions => {
  const { args } = params;
  let semver = "";
  let githubOutputPath = "";
  let shouldUpdatePackage = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument.startsWith("--semver=")) {
      semver = argument.slice("--semver=".length);
      continue;
    }

    if (argument === "--semver" || argument === "-s") {
      const nextIndex = index + 1;
      if (nextIndex >= args.length) {
        console.error("Missing value for --semver flag");
        process.exit(1);
      }
      semver = args[nextIndex];
      index = nextIndex;
      continue;
    }

    if (argument.startsWith("--github-output=")) {
      githubOutputPath = argument.slice("--github-output=".length);
      continue;
    }

    if (argument === "--github-output") {
      const nextIndex = index + 1;
      if (nextIndex >= args.length) {
        console.error("Missing value for --github-output flag");
        process.exit(1);
      }
      githubOutputPath = args[nextIndex];
      index = nextIndex;
      continue;
    }

    if (argument === "--update-package") {
      shouldUpdatePackage = true;
      continue;
    }

    if (semver.length === 0 && argument.startsWith("--") === false) {
      semver = argument;
    }
  }

  if (githubOutputPath.length === 0) {
    const envValue = Bun.env.GITHUB_OUTPUT;
    if (typeof envValue === "string" && envValue.length > 0) {
      githubOutputPath = envValue;
    }
  }

  return {
    semver,
    githubOutputPath,
    shouldUpdatePackage,
  };
};

type NormalizeSemverParams = {
  value: string;
};

type BumpPatchParams = {
  currentVersion: string;
};

type WriteOutputsParams = {
  lines: string[];
  githubOutputPath: string;
};

type UpdatePackageParams = {
  version: string;
  packageJsonText: string;
  packageJsonPath: URL;
};

const normalizeSemver = (params: NormalizeSemverParams): string => {
  const { value } = params;
  if (value.length === 0) {
    return value;
  }
  if (value.startsWith("v")) {
    return value.slice(1);
  }
  return value;
};

const bumpPatch = (params: BumpPatchParams): string => {
  const { currentVersion } = params;
  const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  const match = semverPattern.exec(currentVersion);

  if (match === null) {
    console.error(`Unable to parse current version: ${currentVersion}`);
    process.exit(1);
  }

  const major = match[1];
  const minor = match[2];
  const patch = match[3];
  const patchNumber = Number.parseInt(patch, 10);

  if (Number.isFinite(patchNumber) === false) {
    console.error(`Current patch is not numeric: ${patch}`);
    process.exit(1);
  }

  return `${major}.${minor}.${patchNumber + 1}`;
};

const writeOutputs = async (params: WriteOutputsParams): Promise<void> => {
  const { lines, githubOutputPath } = params;
  if (githubOutputPath.length === 0) {
    return;
  }
  await Bun.write(githubOutputPath, `${lines.join("\n")}\n`, {
    append: true,
  });
};

const updatePackageVersion = async (params: UpdatePackageParams): Promise<void> => {
  const { version, packageJsonText, packageJsonPath } = params;
  const updatedPackageJson = packageJsonText.replace(
    /("version"\s*:\s*")([^"]+)(")/,
    (_match, prefix: string, _value: string, suffix: string) => `${prefix}${version}${suffix}`,
  );
  await Bun.write(packageJsonPath, `${updatedPackageJson}\n`);
  console.log(`Updated package.json to version ${version}`);
};

const main = async (): Promise<void> => {
  const [, , ...argv] = Bun.argv;
  const options = parseOptions({ args: argv });
  const trimmedInput = options.semver.trim();

  const packageJsonPath = new URL("../package.json", import.meta.url);
  const packageJsonFile = Bun.file(packageJsonPath);

  if ((await packageJsonFile.exists()) === false) {
    console.error("packages/cli/package.json not found");
    process.exit(1);
  }

  const packageJsonText = await packageJsonFile.text();
  const versionMatch = /"version"\s*:\s*"([^"]+)"/.exec(packageJsonText);

  if (versionMatch === null) {
    console.error("Unable to locate version field in package.json");
    process.exit(1);
  }

  const currentVersion = versionMatch[1];
  const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  let releaseVersion: string;

  if (trimmedInput.length > 0) {
    const candidate = normalizeSemver({ value: trimmedInput });
    if (semverPattern.test(candidate) === false) {
      console.error(`Provided semver is invalid: ${options.semver}`);
      process.exit(1);
    }
    releaseVersion = candidate;
  } else {
    releaseVersion = bumpPatch({ currentVersion });
  }

  const releaseTag = `v${releaseVersion}`;
  const outputLines = [
    `release_version=${releaseVersion}`,
    `release_tag=${releaseTag}`,
    `previous_version=${currentVersion}`,
  ];

  console.log(outputLines.join("\n"));
  await writeOutputs({ lines: outputLines, githubOutputPath: options.githubOutputPath });

  if (options.shouldUpdatePackage) {
    await updatePackageVersion({
      version: releaseVersion,
      packageJsonText,
      packageJsonPath,
    });
  }
};

void main();
