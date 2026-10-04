/// <reference lib="webworker" />
import { compressBuffer, type CompressInput } from "./core";

self.onmessage = async (event: MessageEvent<{ id: number; input: CompressInput }>) => {
  const { id, input } = event.data;
  const output = await compressBuffer(input);
  const transfer = output.buffer ? [output.buffer] : [];
  (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, output }, transfer);
};
