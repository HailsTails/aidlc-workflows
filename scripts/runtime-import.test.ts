import { expect, test } from 'bun:test';
import { runtimeImportKind } from './runtime-import.ts';
test('Bun FFI is supplied by the runtime rather than npm', () => { expect(runtimeImportKind({ specifier: 'bun:ffi' })).toBe('runtime-builtin'); });
test('Node protocol and Bun public module retain runtime ownership', () => { expect(runtimeImportKind({ specifier: 'node:fs' })).toBe('runtime-builtin'); expect(runtimeImportKind({ specifier: 'bun' })).toBe('runtime-builtin'); });
test('a sibling remains an authored source dependency', () => { expect(runtimeImportKind({ specifier: './aidlc-report-target.ts' })).toBe('relative-source'); });
test('external libraries need dependency preparation', () => { expect(runtimeImportKind({ specifier: 'jsonc-parser' })).toBe('external'); });
test('a similarly named package cannot borrow the builtin classification', () => { expect(runtimeImportKind({ specifier: 'bun-package' })).toBe('external'); });
