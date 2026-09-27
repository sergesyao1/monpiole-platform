import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { CancelRentalLease, CloseRentalBooking, CompleteCleaningTurnover, CompletePropertyInspection, CheckoutShortTermStay, EndRentalOccupancy, ExtendCleaningTurnover, ExtendRentalBooking, ListRentalOperations, RenewRentalLease, StartBookingStay, StartLeaseOccupancy } from "@monpiole/rental-operations";
import { createZodDto, ZodSerializerDto } from "nestjs-zod";
import { BookingClosureSchema, CheckoutSchema, CompleteCleaningSchema, EndOccupancySchema, ExceptionalClosureSchema, InspectionResponseSchema, InspectionSchema, LifecycleListSchema, LifecycleSnapshotSchema, RentalOperationPathSchema, StartBookingStaySchema, StartLeaseOccupancySchema, TemporalExtensionSchema, TurnoverResponseSchema } from "../../contracts/v1/rental-operations/rental-operations.schema.js";
import { AUTHENTICATED_AUTHORITY_PROVIDER, requireAuthenticatedAuthority, toRentalOperationsAuthority, type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import { problemContent } from "../properties/create-property.controller.js";
import type { RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";

class PathDto extends createZodDto(RentalOperationPathSchema) {} class StartLeaseDto extends createZodDto(StartLeaseOccupancySchema) {}
class StartBookingDto extends createZodDto(StartBookingStaySchema) {} class EndDto extends createZodDto(EndOccupancySchema) {}
class InspectionDto extends createZodDto(InspectionSchema) {} class CheckoutDto extends createZodDto(CheckoutSchema) {}
class CompleteCleaningDto extends createZodDto(CompleteCleaningSchema) {} class SnapshotDto extends createZodDto(LifecycleSnapshotSchema) {}
class ExceptionalClosureDto extends createZodDto(ExceptionalClosureSchema) {} class BookingClosureDto extends createZodDto(BookingClosureSchema) {}
class TemporalExtensionDto extends createZodDto(TemporalExtensionSchema) {}
class ListDto extends createZodDto(LifecycleListSchema) {} class InspectionResultDto extends createZodDto(InspectionResponseSchema) {}
class TurnoverDto extends createZodDto(TurnoverResponseSchema) {}

export const RENTAL_OPERATIONAL_LIFECYCLE = Symbol("monpiole.rental-operational-lifecycle");
export interface RentalOperationalLifecycleApi {
  readonly list: Pick<ListRentalOperations, "execute">; readonly startLease: Pick<StartLeaseOccupancy, "execute">;
  readonly startBooking: Pick<StartBookingStay, "execute">; readonly completeInspection: Pick<CompletePropertyInspection, "execute">;
  readonly endOccupancy: Pick<EndRentalOccupancy, "execute">; readonly checkout: Pick<CheckoutShortTermStay, "execute">;
  readonly completeCleaning: Pick<CompleteCleaningTurnover, "execute">;
  readonly cancelLease: Pick<CancelRentalLease, "execute">; readonly closeBooking: Pick<CloseRentalBooking, "execute">;
  readonly extendBooking: Pick<ExtendRentalBooking, "execute">; readonly renewLease: Pick<RenewRentalLease, "execute">;
  readonly extendCleaning: Pick<ExtendCleaningTurnover, "execute">;
}

@ApiTags("Rental operations") @ApiBearerAuth() @TenantContext("not-applicable") @Controller("v1/rental-operations")
export class RentalOperationsController {
  constructor(@Inject(RENTAL_OPERATIONAL_LIFECYCLE) private readonly lifecycle: RentalOperationalLifecycleApi,
    @Inject(AUTHENTICATED_AUTHORITY_PROVIDER) private readonly authorityProvider: AuthenticatedAuthorityProvider) {}
  @Get() @ApiOperation({ operationId: "listRentalOperations" }) @ApiOkResponse({ type: ListDto }) @ZodSerializerDto(ListDto)
  async list(@Req() request: RequestWithContext) { return { items: await this.lifecycle.list.execute({ authority: await this.authority(request) }) }; }
  @Post("leases/:id/occupancies") @HttpCode(200) @ApiOperation({ operationId: "startLeaseOccupancy" }) @ApiOkResponse({ type: SnapshotDto }) @ApiResponse({ status: 409, content: problemContent() }) @ZodSerializerDto(SnapshotDto)
  async startLease(@Param() path: PathDto, @Body() body: StartLeaseDto, @Req() request: RequestWithContext) { return this.lifecycle.startLease.execute({ authority: await this.authority(request), leaseId: path.id, ...body }); }
  @Post("bookings/:id/stays") @HttpCode(200) @ApiOperation({ operationId: "startBookingStay" }) @ApiOkResponse({ type: SnapshotDto }) @ZodSerializerDto(SnapshotDto)
  async startBooking(@Param() path: PathDto, @Body() body: StartBookingDto, @Req() request: RequestWithContext) { return this.lifecycle.startBooking.execute({ authority: await this.authority(request), bookingId: path.id, ...body }); }
  @Post("inspections") @HttpCode(200) @ApiOperation({ operationId: "completeRentalInspection" }) @ApiOkResponse({ type: InspectionResultDto }) @ZodSerializerDto(InspectionResultDto)
  async completeInspection(@Body() body: InspectionDto, @Req() request: RequestWithContext) { return this.lifecycle.completeInspection.execute({ authority: await this.authority(request), ...body }); }
  @Post("occupancies/:id/end") @HttpCode(200) @ApiOperation({ operationId: "endRentalOccupancy" }) @ApiOkResponse({ type: SnapshotDto }) @ZodSerializerDto(SnapshotDto)
  async end(@Param() path: PathDto, @Body() body: EndDto, @Req() request: RequestWithContext) { return this.lifecycle.endOccupancy.execute({ authority: await this.authority(request), occupancyId: path.id, ...body }); }
  @Post("occupancies/:id/checkout") @HttpCode(200) @ApiOperation({ operationId: "checkoutShortTermStay" }) @ApiOkResponse({ type: TurnoverDto }) @ZodSerializerDto(TurnoverDto)
  async checkout(@Param() path: PathDto, @Body() body: CheckoutDto, @Req() request: RequestWithContext) { return this.lifecycle.checkout.execute({ authority: await this.authority(request), occupancyId: path.id, ...body }); }
  @Post("turnovers/:id/complete") @HttpCode(200) @ApiOperation({ operationId: "completeCleaningTurnover" }) @ApiOkResponse({ type: TurnoverDto }) @ZodSerializerDto(TurnoverDto)
  async completeCleaning(@Param() path: PathDto, @Body() body: CompleteCleaningDto, @Req() request: RequestWithContext) { return this.lifecycle.completeCleaning.execute({ authority: await this.authority(request), operationalBlockId: path.id, ...body }); }
  @Post("leases/:id/cancel") @HttpCode(200) @ApiOperation({ operationId: "cancelRentalLease" }) @ApiOkResponse({ type: SnapshotDto }) @ZodSerializerDto(SnapshotDto)
  async cancelLease(@Param() path: PathDto, @Body() body: ExceptionalClosureDto, @Req() request: RequestWithContext) { return this.lifecycle.cancelLease.execute({ authority: await this.authority(request), leaseId: path.id, ...body }); }
  @Post("leases/:id/renew") @HttpCode(200) @ApiOperation({ operationId: "renewRentalLease" }) @ApiOkResponse({ type: SnapshotDto }) @ZodSerializerDto(SnapshotDto)
  async renewLease(@Param() path: PathDto, @Body() body: TemporalExtensionDto, @Req() request: RequestWithContext) { return this.lifecycle.renewLease.execute({ authority: await this.authority(request), leaseId: path.id, ...body }); }
  @Post("bookings/:id/close") @HttpCode(200) @ApiOperation({ operationId: "closeRentalBooking" }) @ApiOkResponse({ type: SnapshotDto }) @ZodSerializerDto(SnapshotDto)
  async closeBooking(@Param() path: PathDto, @Body() body: BookingClosureDto, @Req() request: RequestWithContext) { return this.lifecycle.closeBooking.execute({ authority: await this.authority(request), bookingId: path.id, ...body }); }
  @Post("bookings/:id/extend") @HttpCode(200) @ApiOperation({ operationId: "extendRentalBooking" }) @ApiOkResponse({ type: SnapshotDto }) @ZodSerializerDto(SnapshotDto)
  async extendBooking(@Param() path: PathDto, @Body() body: TemporalExtensionDto, @Req() request: RequestWithContext) { return this.lifecycle.extendBooking.execute({ authority: await this.authority(request), bookingId: path.id, ...body }); }
  @Post("turnovers/:id/extend") @HttpCode(200) @ApiOperation({ operationId: "extendCleaningTurnover" }) @ApiOkResponse({ type: TurnoverDto }) @ZodSerializerDto(TurnoverDto)
  async extendCleaning(@Param() path: PathDto, @Body() body: TemporalExtensionDto, @Req() request: RequestWithContext) { return this.lifecycle.extendCleaning.execute({ authority: await this.authority(request), operationalBlockId: path.id, ...body }); }
  private async authority(request: RequestWithContext) { return toRentalOperationsAuthority(await requireAuthenticatedAuthority(this.authorityProvider, request)); }
}
