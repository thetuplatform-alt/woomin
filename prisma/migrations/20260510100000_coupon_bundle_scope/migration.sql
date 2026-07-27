-- Add bundle-level coupon targeting.
-- Existing coupons keep their behavior: if no courses and no bundles are selected,
-- the coupon remains globally applicable.

CREATE TABLE "_CouponBundles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_CouponBundles_AB_unique" ON "_CouponBundles"("A", "B");
CREATE INDEX "_CouponBundles_B_index" ON "_CouponBundles"("B");

ALTER TABLE "_CouponBundles"
  ADD CONSTRAINT "_CouponBundles_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Bundle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_CouponBundles"
  ADD CONSTRAINT "_CouponBundles_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Coupon"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
