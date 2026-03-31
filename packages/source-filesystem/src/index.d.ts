import type { CollectionSource } from '@cl3/core';
export interface FilesystemSourceOptions {
    contentDir: string;
    pattern: string | string[];
    extensions?: string[];
}
export declare function filesystem(options: FilesystemSourceOptions): CollectionSource<unknown>;
//# sourceMappingURL=index.d.ts.map