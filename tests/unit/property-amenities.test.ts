import { describe, expect, it, vi } from "vitest";
import { InvalidPropertyAmenitiesError, ReplacePropertyAmenities, RetrieveAmenityCatalog, RetrievePropertyAmenities, PropertyNotFoundError, type PropertyAmenityRepository } from "../../services/property-management/src/index.js";
const TENANT="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", PROPERTY="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const authority={actorId:"actor",authorityId:"authority",tenantIds:[TENANT],grants:["RETRIEVE_PROPERTY_AMENITIES","UPDATE_PROPERTY_AMENITIES"] as const};
function repository():PropertyAmenityRepository{return{findCodes:vi.fn(async()=>["WIFI"] as const),replace:vi.fn(async(_tenant,_property,codes)=>codes)}}
describe("Property amenities",()=>{
 it("exposes the canonical catalog",()=>{const items=new RetrieveAmenityCatalog().execute();expect(items).toHaveLength(42);expect(items).toContainEqual(expect.objectContaining({code:"WIFI",category:"CONNECTIVITY"}));});
 it("retrieves and atomically replaces a tenant property selection",async()=>{const repo=repository();expect(await new RetrievePropertyAmenities(repo).execute({authority,propertyId:PROPERTY})).toEqual(["WIFI"]);expect(await new ReplacePropertyAmenities(repo,{now:()=>"2026-09-09T00:00:00.000Z"}).execute({authority,propertyId:PROPERTY,amenityCodes:["PARKING","WIFI"],correlationId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"})).toEqual(["PARKING","WIFI"]);expect(repo.replace).toHaveBeenCalledWith(TENANT,PROPERTY,["PARKING","WIFI"],expect.objectContaining({actorId:"actor"}));});
 it("rejects duplicate and unknown codes",async()=>{const useCase=new ReplacePropertyAmenities(repository(),{now:()=>"2026-09-09T00:00:00.000Z"});await expect(useCase.execute({authority,propertyId:PROPERTY,amenityCodes:["WIFI","WIFI"],correlationId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"})).rejects.toBeInstanceOf(InvalidPropertyAmenitiesError);});
 it("keeps missing properties non revealing",async()=>{const repo=repository();vi.mocked(repo.findCodes).mockResolvedValue(undefined);await expect(new RetrievePropertyAmenities(repo).execute({authority,propertyId:PROPERTY})).rejects.toBeInstanceOf(PropertyNotFoundError);});
});
