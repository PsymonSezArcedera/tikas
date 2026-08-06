-- CreateEnum
CREATE TYPE "UnitPreference" AS ENUM ('METRIC', 'IMPERIAL');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "goalWeight" DOUBLE PRECISION,
    "birthday" TIMESTAMP(3),
    "gender" "Gender",
    "activityLevel" "ActivityLevel",
    "unitPreference" "UnitPreference" NOT NULL DEFAULT 'METRIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
