export function isLocalDemo(development: boolean, enabled: string | undefined, hostname: string): boolean {
  return development && enabled === "true" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname);
}

