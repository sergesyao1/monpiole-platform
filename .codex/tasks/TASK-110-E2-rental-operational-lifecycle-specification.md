# TASK-110-E2 - Rental Operations Operational Lifecycle Specification

## Status

DONE - normative specification for E3-E7.

## Scope and ownership

Rental Operations owns operational execution, actual stays and occupancies, inspections,
operational availability claims and operational blocks. Property Management continues to own
property structure, eligibility and publication. Billing owns financial truth. Maintenance remains
a separate bounded context. No transition in this specification writes another context's tables.

All tenant-owned commands derive `tenantId` from authenticated authority. All instants are UTC and
all availability intervals are half-open `[startsAt, endsAt)`.

## Canonical provenance

- Long term: `PropertyContract -> Lease -> Occupancy`.
- Short term: `Booking -> Stay -> Occupancy`.
- A Stay belongs to exactly one Booking and an Occupancy has exactly one mode-specific source.
- ENTRY and EXIT inspections share one model and point to the same operational provenance.
- RentalAllocation remains the temporal claim; lifecycle records do not duplicate availability.
- OperationalBlock represents cleaning, preparation, maintenance integration and other operational
  exclusions. A block is never represented by a fake Lease or Booking.

## State machines

### Long-term Lease execution

`PREPARING -> OCCUPIED -> ENDED`

`PREPARING -> CANCELLED` is permitted only before actual Occupancy starts. Operationalization creates
or validates the Lease allocation without changing contractual dates. Starting Occupancy records an
actual start. Ending it records an actual end and closes/releases its temporal claim transactionally.

### Booking

`CONFIRMED -> IN_STAY -> COMPLETED`

Before execution only, `CONFIRMED -> CANCELLED` or `CONFIRMED -> NO_SHOW` is allowed. Cancellation and
no-show release the Booking allocation. They never create a Stay or Occupancy.

### Stay

`PREPARING -> ACTIVE -> COMPLETED`

A single PREPARING Stay may be created for a confirmed Booking. ENTRY completion/check-in activates
the Stay. EXIT completion/check-out completes it after its Occupancy has ended. Actual check-in and
checkout do not overwrite Booking arrival/departure.

### Occupancy

`ACTIVE -> ENDED`

Creation is the start transition and records the actual start instant. The source is a Lease in long
term and a Stay in short term. End records the actual end. There may be at most one active Occupancy
for a source and for any conflicting asset scope.

### PropertyInspection

`DRAFT -> COMPLETED`

ENTRY and EXIT use this same lifecycle. A completed inspection is immutable; replay with the same
idempotency key returns its result, while different content conflicts. E4 adds structured condition
records and evidence references.

## Transition matrix

| Command | Source state | Result | Required facts | Availability/catalog effect | Event |
| --- | --- | --- | --- | --- | --- |
| Operationalize Lease | eligible contract | Lease PREPARING | tenant source and target match | create/validate LEASE allocation | lease-operationalized, allocation-created |
| Complete LT ENTRY | Lease PREPARING | ENTRY COMPLETED | source, target, mode match | none | entry-inspection-completed |
| Start LT Occupancy | Lease PREPARING | OCCUPIED + ACTIVE | completed ENTRY | retain LEASE allocation; REMOVE_FROM_RENTAL_CATALOG | occupancy-started |
| Complete LT EXIT | active Occupancy | EXIT COMPLETED | ENTRY and active Occupancy | none | exit-inspection-completed |
| End LT Occupancy | EXIT completed | ENDED | end after start | release/close LEASE allocation; catalog may recover | occupancy-ended, allocation-released |
| Confirm Booking | eligible request | CONFIRMED | bounded free interval | create BOOKING allocation | booking-confirmed, allocation-created |
| Prepare Stay | Booking CONFIRMED | Stay PREPARING | one Stay per Booking | retain Booking interval | none |
| Complete ST ENTRY | Stay PREPARING | ENTRY COMPLETED | Booking still confirmed | none | entry-inspection-completed |
| Start Stay/Occupancy | ENTRY completed | ACTIVE/ACTIVE | same tenant, target and mode | retain Booking interval only | stay-started, occupancy-started |
| Complete ST EXIT | active Occupancy | EXIT COMPLETED | ENTRY and active Occupancy | none | exit-inspection-completed |
| Checkout | EXIT completed | Occupancy ENDED, Stay/Booking COMPLETED | actual checkout after check-in | retain claim until closure; create explicit turnover block if required | occupancy-ended, stay-completed |
| Complete turnover | active block | block RELEASED | completion is authorized | release block; next availability recalculated by existing engine | operational-block-released |

## Preconditions and invariants

- ENTRY completion requires a PREPARING Lease or Stay with matching tenant, target and mode.
- Occupancy start requires a completed ENTRY inspection. There is no silent inspection bypass in V1.
- EXIT completion requires an active Occupancy and its completed ENTRY inspection.
- Occupancy end and short-term Stay completion require completed EXIT inspection.
- Every multi-record mutation locks the source row, checks current state, and commits atomically.
- Stable command/idempotency identifiers make exact replay convergent; a reused key with changed
  intent is a conflict.
- Database uniqueness prevents duplicate Stay per Booking and duplicate active Occupancy per source.
- Explicit tenant predicates and RLS are both required; absence is treated as not found.

## Planned and actual time

- Booking `arrivalAt/departureAt` are planned and immutable during execution.
- Stay `actualCheckInAt/actualCheckOutAt` are actual and independently recorded.
- Lease keeps its contractual/planned period at its source boundary.
- Occupancy `startedAt/endedAt` are actual and independently recorded.
- An early departure/termination records an earlier actual end; it never rewrites planned dates.
- Delayed arrival records a later actual start within the still-valid allocation.

## Exceptional scenarios

- Cancellation/no-show is allowed only before Stay/Occupancy execution and releases the allocation.
- Duplicate check-in, checkout, inspection completion and closure converge only for the same command;
  otherwise they return a lifecycle conflict.
- Extension or renewal changes temporal claims through the existing availability service before any
  planned boundary is changed. Conflicts reject the whole transaction.
- Overstay records actual time and requires a validated allocation extension or explicit operational
  block; it must not silently consume another reservation's interval.
- Early departure/termination can release unused time only after operational closure requirements.
- Damage discovered at EXIT is an operational fact, not a charge. It may retain/create a bounded
  operational block and emit facts for future Maintenance/Billing adapters.
- Cleaning delay extends its OperationalBlock, not the completed Booking or Stay.

## Availability and catalog rules

- All overlap and hierarchy decisions delegate to TASK-110-C services and GiST protections.
- A short-term Booking blocks only its interval. Free time before, between and after remains bookable.
- Inspections and actual timestamps do not create a second availability calculation.
- Cleaning/preparation/maintenance exclusion is represented by OperationalBlock.
- Effective long-term Occupancy yields `REMOVE_FROM_RENTAL_CATALOG`; Rental Operations does not mutate
  publication state. Short-term execution never globally removes the property from the catalog.

## Events

E3-E5 reuse the existing event family. No new event is required by the state machines. Cancellation,
no-show, inspection-detail and turnover facts may justify new events only when a consumer contract is
introduced; until then state and allocation/block events are authoritative.

## Implementation decisions for E3-E7

- E3 adds lifecycle columns/constraints and transactional repository use cases on existing entities.
- E4 enriches the shared inspection entity with details and external evidence references.
- E5 composes checkout with existing OperationalBlock and temporal availability services.
- E6 exposes capability-driven authenticated DTOs and never exposes private inspection data publicly.
- E7 consumes API capabilities and provides one French operations workspace for both modes.
