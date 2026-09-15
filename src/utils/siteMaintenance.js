export const siteMaintenanceEndsAtMs = (maintenance) => (
  maintenance?.endsAt?.toMillis?.() || 0
);

export const isSiteMaintenanceActiveAt = (maintenance, now = Date.now()) => (
  maintenance?.enabled === true && siteMaintenanceEndsAtMs(maintenance) > now
);
