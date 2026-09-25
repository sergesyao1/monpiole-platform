import { Body,Controller,HttpCode,Inject,Param,Post,Req } from "@nestjs/common";
import { ApiOkResponse,ApiOperation,ApiSecurity,ApiTags } from "@nestjs/swagger";
import type { CreatePropertyContractFromApplication } from "@monpiole/property-management";
import { createZodDto,ZodSerializerDto } from "nestjs-zod";
import { CreatePropertyApplicationContractRequestSchema,PropertyApplicationPathSchema,PropertyContractResponseSchema } from "../../contracts/v1/properties/property-application-contract.schema.js";
import { AUTHENTICATED_AUTHORITY_PROVIDER,requireAuthenticatedAuthority,toPropertyAuthority,type AuthenticatedAuthorityProvider } from "../authenticated-authority/authenticated-authority.js";
import { REQUEST_CONTEXT,type RequestWithContext } from "../request-context/request-context.js";
import { TenantContext } from "../request-context/request-context.decorator.js";
import { toPropertyContractResponse } from "./property-client-contract.mapper.js";
export const CREATE_PROPERTY_CONTRACT_FROM_APPLICATION=Symbol("create-property-contract-from-application");
class PathDto extends createZodDto(PropertyApplicationPathSchema){}class RequestDto extends createZodDto(CreatePropertyApplicationContractRequestSchema){}class ResponseDto extends createZodDto(PropertyContractResponseSchema){}
@ApiTags("Property contracts")@ApiSecurity("bearer")@Controller("v1/properties/:propertyId/applications/:applicationId/contract")@TenantContext("not-applicable")
export class PropertyApplicationContractsController{constructor(@Inject(CREATE_PROPERTY_CONTRACT_FROM_APPLICATION)private readonly create:Pick<CreatePropertyContractFromApplication,"execute">,@Inject(AUTHENTICATED_AUTHORITY_PROVIDER)private readonly auth:AuthenticatedAuthorityProvider){}
@Post()@HttpCode(200)@ApiOperation({operationId:"createPropertyContractFromApplication",summary:"Create the canonical lease contract from a converted application"})@ApiOkResponse({type:ResponseDto})@ZodSerializerDto(ResponseDto)
async post(@Param()path:PathDto,@Body()body:RequestDto,@Req()request:RequestWithContext){const context=request[REQUEST_CONTEXT];if(!context)throw new Error("Request context missing");const authority=toPropertyAuthority(await requireAuthenticatedAuthority(this.auth,request));return toPropertyContractResponse(await this.create.execute({authority,...path,...body,correlationId:context.correlationId}));}}
