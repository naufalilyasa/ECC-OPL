// Minimal Inertia shim so the REAL AppLayout/PageHeader/Bell components render in an
// isolated browser without a Laravel server. Component/source code is untouched.
import { createElement, type ReactNode } from 'react';

const PAGE = (globalThis as any).__DB2_PAGE__ ?? {};

export function usePage<T = any>(): { props: T; url: string } {
  return { props: PAGE as T, url: PAGE.url ?? '/' };
}

export function Link({ href, children, ...rest }: { href: string; children?: ReactNode; [k: string]: any }) {
  return createElement('a', { href, ...rest }, children);
}

export function Head({ children }: { children?: ReactNode }) {
  return createElement('div', { hidden: true }, children);
}

export const router = { get() {}, post() {}, reload() {}, visit() {} };
