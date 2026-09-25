-- CreateIndex
CREATE INDEX "AppointmentRequest_status_startDatetime_endDatetime_idx" ON "AppointmentRequest"("status", "startDatetime", "endDatetime");
