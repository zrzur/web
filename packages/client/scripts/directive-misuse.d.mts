export declare const FORWARDING: Set<string>;

export declare function findDirectiveMisuse(
  src: string,
  directives: string[],
): { line: number; component: string; directive: string }[];
