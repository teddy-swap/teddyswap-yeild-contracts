import { PAsData, PTokenName, Term, toData } from "@harmoniclabs/plu-ts";

export function asciiToPTokenName( ascii: string ): Term<PAsData<typeof PTokenName>>
{
    return toData( PTokenName.type )( PTokenName.from(Buffer.from(ascii,"ascii")) );
}