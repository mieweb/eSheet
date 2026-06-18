import type { AssetLoad } from '@kerebron/editor';

let _assetLoad: AssetLoad | undefined;

export function setAssetLoad(fn: AssetLoad) {
  _assetLoad = fn;
}

export function getAssetLoad(): AssetLoad | undefined {
  return _assetLoad;
}
