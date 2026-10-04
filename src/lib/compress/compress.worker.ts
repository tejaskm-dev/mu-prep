/// <reference lib="webworker" />
import { compressBuffer, type CompressInput, type CompressOutput } from "./core";

self.onmessage = async (event: MessageEvent<{ id: number; input: CompressInput }>) => {
  const { id, input } = event.data;
  try {
    const output = await compressBuffer(input);
    const transfer = output.buffer ? [output.buffer] : [];
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, output }, transfer);
  } catch (err) {
    const fallback: CompressOutput = {
      buffer: null,
      name: input.name,
      type: input.type,
      originalSize: input.buffer.byteLength,
      compressedSize: input.buffer.byteLength,
      method: "none",
      detail: err instanceof Error ? err.message : "Worker compression error",
    };
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, output: fallback }, []);
  }
};

