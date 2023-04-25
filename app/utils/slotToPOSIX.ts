import { getNetworkStartPOSIX } from "./getNetworkStartPOSIX";
import { getSlotLengthMs } from "./getSlotLengthMs";

export async function slotToPOSIX( slot: number ): Promise<number>
{
    const [ start, sLen ] = await Promise.all([
        getNetworkStartPOSIX(),
        getSlotLengthMs()
    ]);

    return start + (sLen * slot);
}