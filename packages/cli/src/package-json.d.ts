declare module '../package.json' {
  interface PackageMetadata {
    readonly name: string;
    readonly version: string;
  }

  const value: PackageMetadata;
  export default value;
}
