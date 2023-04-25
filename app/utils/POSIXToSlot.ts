import { getNetworkStartPOSIX } from "./getNetworkStartPOSIX";
import { getSlotLengthMs } from "./getSlotLengthMs";

export async function POSIXToSlot( POSIX: number ): Promise<number>
{
    const [ start, sLen ] = await Promise.all([
        getNetworkStartPOSIX(),
        getSlotLengthMs()
    ]);

    return Math.floor( (POSIX - start) / sLen );
}