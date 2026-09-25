CREATE TABLE "property_management"."amenities" (
	"code" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"label_fr" text NOT NULL,
	"display_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_management"."property_amenities" (
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"amenity_code" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "property_amenities_tenant_id_property_id_amenity_code_pk" PRIMARY KEY("tenant_id","property_id","amenity_code")
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_amenities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_amenities" ADD CONSTRAINT "property_amenities_property_tenant_fk" FOREIGN KEY ("tenant_id","property_id") REFERENCES "property_management"."properties"("tenant_id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_management"."property_amenities" ADD CONSTRAINT "property_amenities_amenity_fk" FOREIGN KEY ("amenity_code") REFERENCES "property_management"."amenities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "amenities_category_order_unique" ON "property_management"."amenities" USING btree ("category","display_order");--> statement-breakpoint
CREATE INDEX "property_amenities_tenant_property_idx" ON "property_management"."property_amenities" USING btree ("tenant_id","property_id");--> statement-breakpoint
CREATE POLICY "property_amenities_tenant_isolation" ON "property_management"."property_amenities" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_amenities"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("property_management"."property_amenities"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "property_management"."property_amenities" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
INSERT INTO "property_management"."amenities" ("code","category","label_fr","display_order") VALUES
('AIR_CONDITIONING','COMFORT','Climatisation',0),
('FAN','COMFORT','Ventilateur',1),
('HOT_WATER','COMFORT','Eau chaude',2),
('WATER_HEATER','COMFORT','Chauffe-eau',3),
('WASHING_MACHINE','COMFORT','Lave-linge',4),
('IRON','COMFORT','Fer à repasser',5),
('TELEVISION','COMFORT','Télévision',6),
('EQUIPPED_KITCHEN','KITCHEN','Cuisine équipée',7),
('REFRIGERATOR','KITCHEN','Réfrigérateur',8),
('FREEZER','KITCHEN','Congélateur',9),
('MICROWAVE','KITCHEN','Four à micro-ondes',10),
('OVEN','KITCHEN','Four',11),
('COOKTOP','KITCHEN','Plaque de cuisson',12),
('KITCHENWARE','KITCHEN','Ustensiles de cuisine',13),
('WIFI','CONNECTIVITY','Wi-Fi',14),
('ETHERNET','CONNECTIVITY','Connexion Ethernet',15),
('SATELLITE_TV','CONNECTIVITY','Télévision par satellite',16),
('GENERATOR','ENERGY_WATER','Groupe électrogène',17),
('BACKUP_POWER','ENERGY_WATER','Alimentation électrique de secours',18),
('WATER_TANK','ENERGY_WATER','Réservoir d''eau',19),
('BOREHOLE','ENERGY_WATER','Forage',20),
('SOLAR_POWER','ENERGY_WATER','Énergie solaire',21),
('SECURITY_GUARD','SECURITY','Gardiennage',22),
('CCTV','SECURITY','Vidéosurveillance',23),
('CONTROLLED_ACCESS','SECURITY','Accès contrôlé',24),
('SMOKE_DETECTOR','SECURITY','Détecteur de fumée',25),
('FIRE_EXTINGUISHER','SECURITY','Extincteur',26),
('ELEVATOR','BUILDING','Ascenseur',27),
('PARKING','BUILDING','Parking',28),
('COVERED_PARKING','BUILDING','Parking couvert',29),
('RECEPTION','BUILDING','Réception',30),
('ACCESSIBLE_ACCESS','BUILDING','Accès adapté',31),
('BALCONY','OUTDOOR','Balcon',32),
('TERRACE','OUTDOOR','Terrasse',33),
('GARDEN','OUTDOOR','Jardin',34),
('SWIMMING_POOL','OUTDOOR','Piscine',35),
('CHILDREN_PLAY_AREA','OUTDOOR','Aire de jeux pour enfants',36),
('HOUSEKEEPING','SERVICES','Service de ménage',37),
('LAUNDRY_SERVICE','SERVICES','Service de blanchisserie',38),
('ROOM_SERVICE','SERVICES','Service en chambre',39),
('BREAKFAST','SERVICES','Petit-déjeuner',40),
('CONCIERGE','SERVICES','Conciergerie',41);
--> statement-breakpoint
GRANT SELECT ON TABLE "property_management"."amenities" TO "monpiole_runtime";
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "property_management"."property_amenities" TO "monpiole_runtime";
--> statement-breakpoint
CREATE VIEW "property_management"."public_property_amenities" AS
SELECT pa.property_id, a.code, a.category, a.label_fr, a.display_order
FROM "property_management"."property_amenities" pa
JOIN "property_management"."amenities" a ON a.code=pa.amenity_code AND a.active=TRUE
JOIN "property_management"."properties" p ON p.tenant_id=pa.tenant_id AND p.property_id=pa.property_id
WHERE p.status='PUBLISHED' AND pa.tenant_id=NULLIF(current_setting('app.tenant_id', true), '')::uuid;
--> statement-breakpoint
GRANT SELECT ON TABLE "property_management"."public_property_amenities" TO "monpiole_public_catalog_reader";
