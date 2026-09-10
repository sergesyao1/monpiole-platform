import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PropertyApplicationsSection } from "./PropertyApplicationsSection.js";

const P="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",A="ffffffff-ffff-4fff-8fff-ffffffffffff",NOW="2026-09-10T12:00:00.000Z";
const application={applicationId:A,propertyId:P,inquiryId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",viewingId:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",outcomeId:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",status:"APPROVED"as const,createdAt:NOW,updatedAt:NOW,decidedAt:NOW};
const conversion={applicationId:A,convertedAt:NOW,client:{clientId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",displayName:"Awa Koné",email:"awa@example.com",createdAt:NOW,updatedAt:NOW}};
function api(existing=false){return{listPropertyApplications:vi.fn(async()=>({items:[application],pageInfo:{hasNextPage:false,nextCursor:null}})),approvePropertyApplication:vi.fn(),rejectPropertyApplication:vi.fn(),withdrawPropertyApplication:vi.fn(),retrievePropertyApplicationClient:vi.fn(async()=>{if(!existing)throw new Error("not found");return conversion;}),convertPropertyApplicationToClient:vi.fn(async()=>conversion)};}
describe("Conversion de candidature en client",()=>{
  it("creates a client from an approved application",async()=>{const client=api();render(<PropertyApplicationsSection propertyId={P} api={client}/>);fireEvent.click(await screen.findByText("Créer le client"));expect(await screen.findByText("Convertie en client")).toBeVisible();expect(screen.getByText("Awa Koné")).toBeVisible();expect(client.convertPropertyApplicationToClient).toHaveBeenCalledWith(P,A);});
  it("shows an existing conversion after reload",async()=>{render(<PropertyApplicationsSection propertyId={P} api={api(true)}/>);expect(await screen.findByText("Awa Koné")).toBeVisible();expect(screen.queryByText("Créer le client")).not.toBeInTheDocument();});
});
