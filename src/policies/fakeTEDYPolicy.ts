import { Script, nativeScriptToCbor } from "@harmoniclabs/plu-ts";

export const fakeTEDYPolicy = new Script(
    "NativeScript",
    nativeScriptToCbor({
        type: "after",
        slot: 0
    }).toBuffer()
);