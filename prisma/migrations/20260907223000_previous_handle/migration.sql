-- AlterTable
ALTER TABLE "User" ADD COLUMN     "previousHandle" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_previousHandle_key" ON "User"("previousHandle");

