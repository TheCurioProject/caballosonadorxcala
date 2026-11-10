import { LocalPersistenceAdapter } from "../../../src/cala/infrastructure/persistence/local";
import { seedState } from "./seed";
import { ApplicationService } from "../../../src/cala/application/service";
const store = new LocalPersistenceAdapter(process.argv[2], seedState);
try {
  new ApplicationService(store).execute(
    { userId: "user-owner", stepUpUntil: null },
    {
      type: "reservation.save",
      organizationId: "org-estancia",
      propertyId: "property-home",
      guestId: "guest-1",
      inventoryTypeId: "type-home",
      unitId: null,
      ratePlanId: "plan-home",
      arrival: "2030-01-01",
      departure: "2030-01-03",
      adults: 1,
      children: 0,
      status: "confirmed",
      notes: "",
    },
    process.argv[3],
  );
  process.stdout.write("created");
} catch {
  process.stdout.write("conflict");
} finally {
  store.close();
}
