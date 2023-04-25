import { Script, compile, data, pfn, pmakeUnit, unit } from "@harmoniclabs/plu-ts";

export const fakeTEDYPolicy = new Script(
    "PlutusScriptV2",
    compile(
        pfn([
            data,
            data
        ],  unit)
        (( _stuff, _ctx ) => pmakeUnit() )
    )
);