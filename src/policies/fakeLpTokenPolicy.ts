import { Script, compile, data, int, pInt, pfn } from "@harmoniclabs/plu-ts";

export const fakeLpTokenPolicy = new Script(
    "PlutusScriptV2",
    compile(
        pfn([
            data,
            data
        ],  int)
        // doesn't throw so always succeeds
        (( _stuff, _ctx ) => pInt( 1 ) )
    )
)