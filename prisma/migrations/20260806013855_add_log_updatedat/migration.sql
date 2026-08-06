/*
  Warnings:

  - Added the required column `updatedAt` to the `BodyMeasurement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `FoodLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `WeightLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BodyMeasurement" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "FoodLog" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "WeightLog" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
