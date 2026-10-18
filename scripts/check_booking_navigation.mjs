// Isolated wrapper lifecycle checks; no HTTP, real browser or lead submission.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const qa = createRequire(resolve(root, '.local/header-tests/package.json'));
const frontend = createRequire(resolve(root, 'frontend/package.json'));
const { JSDOM } = qa('jsdom');
const { build } = qa('esbuild');
const work = resolve(root, '.local/booking-navigation-tests');
await mkdir(work, { recursive: true });
const result = await build({
  stdin: { contents: `export { BookingDialog } from './src/components/booking-dialog'; export { StoreProvider, useSelection, useAppDispatch, choose, close } from './src/components/store-provider';`, resolveDir: resolve(root, 'frontend'), loader: 'tsx' },
  bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
  tsconfig: resolve(root, 'frontend/tsconfig.json'),
  plugins: [{ name: 'navigation-stubs', setup(builder) {
    builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: frontend.resolve(args.path), external: true }));
    builder.onResolve({ filter: /^next\// }, args => ({ path: args.path, namespace: 'framework' }));
    builder.onLoad({ filter: /.*/, namespace: 'framework' }, args => ({ contents: args.path === 'next/navigation'
      ? `export function usePathname() { return globalThis.__bookingPathname; }`
      : `import { createElement, useEffect, useState } from 'react';
         export default function dynamic(loader, options) {
           return function Deferred(props) {
             const [Component, setComponent] = useState(null);
             useEffect(() => { let active = true;
               loader().then(component => { globalThis.__releaseBookingChunk = () => { if (active) setComponent(() => component); }; });
               return () => { active = false; };
             }, []);
             return Component ? createElement(Component, props) : createElement(options.loading);
           };
         }`, loader: 'js' }));
    builder.onResolve({ filter: /^\.\/lead-dialog$/ }, () => ({ path: 'lead-dialog', namespace: 'stub' }));
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `import { createElement, useEffect } from 'react';
      export function LeadDialog(props) { globalThis.__bookingDialogProps = props;
        useEffect(() => { globalThis.__bookingMounts++; return () => { globalThis.__bookingUnmounts++; }; }, []);
        return createElement('div', { id: 'loaded-booking' });
      }`, loader: 'js' }));
  } }],
});
const bundle = resolve(work, 'navigation.cjs');
await writeFile(bundle, result.outputFiles[0].text);
const dom = new JSDOM('<div id="root"></div>', { url: 'https://preview.example/characters' });
for (const name of ['window', 'document', 'Node', 'HTMLElement', 'Event']) globalThis[name] = dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__bookingPathname = '/characters';
globalThis.__bookingMounts = 0;
globalThis.__bookingUnmounts = 0;
const { createElement, act } = frontend('react');
const { createRoot } = frontend('react-dom/client');
const { BookingDialog, StoreProvider, useSelection, useAppDispatch, choose, close } = frontend(bundle);
let selection, dispatch;
const catalog = { characters: [], offerings: [] };
function Harness() { selection = useSelection(); dispatch = useAppDispatch(); return createElement(BookingDialog, { catalog }); }
const host = createRoot(document.getElementById('root'));
const render = () => act(() => host.render(createElement(StoreProvider, null, createElement(Harness))));
const navigate = async pathname => { globalThis.__bookingPathname = pathname; await render(); };
await render();
assert.equal(document.querySelector('#loaded-booking'), null);
await navigate('/characters/spider-man');
assert.equal(selection.open, false);
await act(() => dispatch(choose({ character: 'spider-man' })));
assert.equal(selection.open, true);
assert.match(document.body.textContent, /Открываем форму/);
await navigate('/characters');
assert.equal(selection.open, false, 'Back while the lazy chunk is pending closes the selection');
await act(() => globalThis.__releaseBookingChunk());
assert.equal(selection.open, false, 'A late chunk must not reopen an abandoned request');
assert.equal(globalThis.__bookingMounts, 1);
await navigate('/characters/spider-man');
await act(() => dispatch(choose({ character: 'spider-man' })));
assert.equal(selection.open, true);
await render();
assert.equal(selection.open, true, 'Same-path rerender does not close the form');
await navigate('/characters');
assert.equal(selection.open, false, 'Back closes an idle dialog');
assert.equal(selection.character, 'spider-man', 'Closing does not erase the selection/draft');
await navigate('/characters/spider-man');
assert.equal(selection.open, false, 'Forward does not reopen the dialog automatically');
await act(() => dispatch(choose({ character: 'spider-man' })));
await act(() => globalThis.__bookingDialogProps.onSubmissionStateChange(true));
await navigate('/characters');
assert.equal(selection.open, true, 'Do not hide a pending submission or suggest it was cancelled');
await act(() => globalThis.__bookingDialogProps.onSubmissionStateChange(false));
await render();
assert.equal(selection.open, true, 'Keep the completed result/error visible after a busy navigation');
await act(() => dispatch(close()));
assert.equal(selection.open, false);
await act(() => dispatch(choose({ character: 'spider-man' })));
await act(() => {
  globalThis.__bookingDialogProps.onSubmissionStateChange(true);
  globalThis.__bookingDialogProps.onSubmissionStateChange(false);
});
await navigate('/characters/spider-man');
assert.equal(selection.open, true, 'A response arriving before a slow route commit must remain visible');
await act(() => dispatch(close()));
await act(() => dispatch(choose({ character: 'spider-man' })));
await navigate('/characters');
assert.equal(selection.open, false, 'Explicit close/reopen resets the submission guard');
assert.equal(globalThis.__bookingMounts, 1, 'Keep the loaded form mounted for same-entry drafts');
assert.equal(globalThis.__bookingUnmounts, 0);
await act(() => host.unmount());
assert.equal(globalThis.__bookingUnmounts, 1);
dom.window.close();
console.log('Booking navigation: initial idle, delayed chunk, Back, Forward, same-path, preserved selection/mount, in-flight result, response-before-route race and guard reset checks passed.');
