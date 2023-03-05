import { WithPath, withPath } from "@harmoniclabs/cardanocli-pluts/dist/utils/path/withPath.js";
import { Script, ScriptType } from "@harmoniclabs/plu-ts";
import { readFileSync } from "fs";
import { Buffer } from "buffer"

export function readScript( path: string ): WithPath<Script>
{
    const json = JSON.parse(
        readFileSync( path, { encoding: "utf-8"} )
    );

    return withPath(
        path,
        new Script(
            json.type === ScriptType.PlutusV1 || json.type === ScriptType.PlutusV2 ? json.type : ScriptType.NativeScript,
            Buffer.from( json.cborHex, "hex" ) ,
        )
    );
}