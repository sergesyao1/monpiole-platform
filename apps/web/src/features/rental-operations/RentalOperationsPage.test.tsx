import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applicationRoutes } from "../../app/routes.js";
import { SessionContext, type Session } from "../../auth/session.js";

const session: Session = { status: "authenticated", user: { name: "Jeanne" }, login: vi.fn(async () => undefined), logout: vi.fn(async () => undefined), getAccessToken: vi.fn(async () => "token") };
const assetId="11111111-1111-4111-8111-111111111111",bookingId="22222222-2222-4222-8222-222222222222";
const preparing={tenantId:"33333333-3333-4333-8333-333333333333",rentableAssetId:assetId,mode:"SHORT_TERM_RENTAL",bookingId,bookingStatus:"CONFIRMED",
  plannedArrivalAt:"2026-10-01T14:00:00.000Z",plannedDepartureAt:"2026-10-05T10:00:00.000Z",capabilities:{canCompleteEntryInspection:true,canStartOccupancy:false,canCompleteExitInspection:false,canEndOccupancy:false}};
function response(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json"}});}
function show(fetcher:typeof fetch){vi.stubGlobal("fetch",fetcher);const router=createMemoryRouter(applicationRoutes,{initialEntries:["/operations-locatives"]});render(<SessionContext.Provider value={session}><RouterProvider router={router}/></SessionContext.Provider>);}

describe("Espace Opérations locatives",()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it("affiche les deux modes, les dates et les actions pilotées par capacités",async()=>{
    const fetcher=vi.fn(async(input:RequestInfo|URL)=>String(input).includes("platform-agency")?new Response(null,{status:403}):response({items:[preparing]}));
    show(fetcher as typeof fetch);
    expect(await screen.findByRole("heading",{name:"Opérations locatives"})).toBeVisible();
    expect(screen.getByText("Location courte durée")).toBeVisible();
    expect(screen.getByLabelText("Pièce ou zone")).toBeRequired();
    expect(screen.getByLabelText("Équipement ou élément")).toBeRequired();
    expect(screen.getByRole("button",{name:"Valider l’état des lieux d’entrée"})).toBeVisible();
    expect(screen.queryByRole("button",{name:"Enregistrer l’arrivée"})).not.toBeInTheDocument();
    expect(screen.getByRole("link",{name:"Ouvrir le bien"})).toHaveAttribute("href",`/properties/${assetId}`);
  });
  it("soumet un état des lieux puis recharge les capacités",async()=>{
    let listCalls=0;const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      if(String(input).includes("platform-agency"))return new Response(null,{status:403});
      if(init?.method==="POST")return response({});
      listCalls+=1;return response({items:[preparing]});
    });show(fetcher as typeof fetch);
    fireEvent.change(await screen.findByLabelText("Pièce ou zone"),{target:{value:"Cuisine"}});
    fireEvent.change(screen.getByLabelText("Équipement ou élément"),{target:{value:"Réfrigérateur"}});
    fireEvent.click(screen.getByRole("button",{name:"Valider l’état des lieux d’entrée"}));
    expect(await screen.findByText("État des lieux d’entrée enregistré.")).toBeVisible();
    await waitFor(()=>expect(listCalls).toBeGreaterThan(1));
    const call=fetcher.mock.calls.find(([input,init])=>String(input).endsWith("/v1/rental-operations/inspections")&&init?.method==="POST");
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({mode:"SHORT_TERM_RENTAL",type:"ENTRY",source:{type:"BOOKING",id:bookingId}});
  });
  it("affiche les états vide et erreur en français",async()=>{
    show(vi.fn(async(input:RequestInfo|URL)=>String(input).includes("platform-agency")?new Response(null,{status:403}):response({items:[]})) as typeof fetch);
    expect(await screen.findByText("Aucune opération locative à traiter.")).toBeVisible();
  });
});
