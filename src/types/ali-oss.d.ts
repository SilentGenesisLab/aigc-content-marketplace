declare module "ali-oss" {
  type Options = { region: string; bucket: string; accessKeyId: string; accessKeySecret: string; secure?: boolean };
  export default class OSS {
    constructor(options: Options);
    put(name: string, data: Buffer, options?: { headers?: Record<string, string> }): Promise<{ url: string }>;
  }
}
