-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "site";

-- CreateTable
CREATE TABLE "site"."properties" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "base_price" DOUBLE PRECISION NOT NULL DEFAULT 15000,
    "base_capacity" INTEGER NOT NULL DEFAULT 12,
    "ical_token" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "min_tour_pax" INTEGER NOT NULL DEFAULT 3,
    "max_tour_pax" INTEGER NOT NULL DEFAULT 10,
    "admin_emails" VARCHAR(500) NOT NULL DEFAULT '',
    "whatsapp_number" VARCHAR(50) NOT NULL DEFAULT '+521234567890',

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."reservas" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL DEFAULT 1,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "guestName" VARCHAR(255) NOT NULL,
    "guestEmail" VARCHAR(255) NOT NULL,
    "guestPhone" VARCHAR(50),
    "payment_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "origin" VARCHAR(100) NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "deposit_paid" DOUBLE PRECISION DEFAULT 0,
    "deposit_currency" TEXT NOT NULL DEFAULT 'MXN',
    "externalId" VARCHAR(255),
    "idCardUrl" VARCHAR(500),
    "notes" TEXT,
    "invoice_language" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."blocked_dates" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL DEFAULT 1,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "reason" VARCHAR(500),
    "source" VARCHAR(50) DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blocked_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."pricing_rules" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL DEFAULT 1,
    "date" TIMESTAMP(3) NOT NULL,
    "price_override" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."ical_sources" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "last_sync" TIMESTAMP(3),
    "sync_status" VARCHAR(50) DEFAULT 'pending',
    "sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ical_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."Experience" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "price" VARCHAR(50),
    "imageUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."AdminUser" (
    "supabase_user_id" UUID,
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "role" VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."booking_addons" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "details" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."addon_pricing" (
    "id" SERIAL NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addon_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."service_pricing" (
    "id" SERIAL NOT NULL,
    "serviceType" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."tour_destinations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "price_per_pax" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."service_bookings" (
    "id" SERIAL NOT NULL,
    "serviceType" TEXT NOT NULL,
    "serviceDetails" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "pax" INTEGER,
    "guestName" VARCHAR(255) NOT NULL,
    "guestEmail" VARCHAR(255) NOT NULL,
    "guestPhone" VARCHAR(50),
    "payment_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "total_price" DOUBLE PRECISION NOT NULL,
    "externalId" VARCHAR(255),
    "notes" TEXT,
    "invoice_language" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."site_images" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "group" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."writers_workshops" (
    "id" SERIAL NOT NULL,
    "title_es" VARCHAR(255) NOT NULL,
    "title_en" VARCHAR(255) NOT NULL,
    "summary_es" TEXT,
    "summary_en" TEXT,
    "description_es" TEXT NOT NULL,
    "description_en" TEXT NOT NULL,
    "image_url" VARCHAR(500),
    "instructor_name" VARCHAR(255),
    "instructor_bio_es" TEXT,
    "instructor_bio_en" TEXT,
    "instructor_image_url" VARCHAR(500),
    "price" VARCHAR(100),
    "dates_es" VARCHAR(255),
    "dates_en" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "writers_workshops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."service_blocked_dates" (
    "id" SERIAL NOT NULL,
    "service_type" VARCHAR(50) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_blocked_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site"."stay_amenities" (
    "id" SERIAL NOT NULL,
    "title_es" VARCHAR(255) NOT NULL,
    "title_en" VARCHAR(255) NOT NULL,
    "short_es" VARCHAR(500) NOT NULL,
    "short_en" VARCHAR(500) NOT NULL,
    "desc_es" TEXT NOT NULL,
    "desc_en" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stay_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "properties_ical_token_key" ON "site"."properties"("ical_token");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_externalId_key" ON "site"."reservas"("externalId");

-- CreateIndex
CREATE INDEX "reservas_start_date_end_date_idx" ON "site"."reservas"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "reservas_property_id_idx" ON "site"."reservas"("property_id");

-- CreateIndex
CREATE INDEX "blocked_dates_start_date_end_date_idx" ON "site"."blocked_dates"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "blocked_dates_property_id_idx" ON "site"."blocked_dates"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_rules_property_id_date_key" ON "site"."pricing_rules"("property_id", "date");

-- CreateIndex
CREATE INDEX "ical_sources_property_id_idx" ON "site"."ical_sources"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_supabase_user_id_key" ON "site"."AdminUser"("supabase_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "site"."AdminUser"("email");

-- CreateIndex
CREATE INDEX "booking_addons_booking_id_idx" ON "site"."booking_addons"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "addon_pricing_type_key" ON "site"."addon_pricing"("type");

-- CreateIndex
CREATE UNIQUE INDEX "service_bookings_externalId_key" ON "site"."service_bookings"("externalId");

-- CreateIndex
CREATE INDEX "service_bookings_start_date_end_date_idx" ON "site"."service_bookings"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "site_images_key_key" ON "site"."site_images"("key");

-- CreateIndex
CREATE INDEX "service_blocked_dates_start_date_end_date_idx" ON "site"."service_blocked_dates"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "service_blocked_dates_service_type_idx" ON "site"."service_blocked_dates"("service_type");

-- AddForeignKey
ALTER TABLE "site"."reservas" ADD CONSTRAINT "reservas_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "site"."properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site"."blocked_dates" ADD CONSTRAINT "blocked_dates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "site"."properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site"."pricing_rules" ADD CONSTRAINT "pricing_rules_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "site"."properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site"."ical_sources" ADD CONSTRAINT "ical_sources_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "site"."properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site"."booking_addons" ADD CONSTRAINT "booking_addons_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "site"."reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

