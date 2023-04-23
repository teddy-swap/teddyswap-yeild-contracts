import { Script, compile, data, int, nativeScriptToCbor, pInt, pfn, pmakeUnit, unit } from "@harmoniclabs/plu-ts";

export const fakeLpTokenPolicy = new Script(
    "NativeScript",
    compile(
        pfn([
            data,
            data
        ],  int)
        // doesn't throw so always succeeds
        (( _stuff, _ctx ) => pInt( 1 ) )
    )
)