import test from "node:test";
import assert from "node:assert/strict";
import { createCustomerSchema, updateCustomerSchema } from "../../src/controller/customer.validation.js";

test("Customer Validation Schema ownerName Compatibility Tests", async (t) => {
  await t.test("updateCustomerSchema accepts ownerName, maps it to contactName, and strips ownerName", () => {
    const parsed = updateCustomerSchema.parse({
      shopName: "Guru krupa store",
      ownerName: "Suresh Patil",
      phone: "+919876543210",
      address: "Main Road, Diva",
      pincode: "400612",
      district: "Thane",
      state: "Maharashtra",
      active: true,
    });

    assert.equal(parsed.shopName, "Guru krupa store");
    assert.equal(parsed.contactName, "Suresh Patil");
    assert.equal("ownerName" in parsed, false);
  });

  await t.test("createCustomerSchema accepts ownerName when contactName is omitted and maps to contactName", () => {
    const parsed = createCustomerSchema.parse({
      shopName: "New Sai Mart",
      ownerName: "Ramesh Patil",
      phone: "+919876543211",
      categoryId: "11111111-1111-4111-8111-111111111111",
      address: "Market Chowk",
      pincode: "400612",
      state: "Maharashtra",
      district: "Thane",
      village: "Diva",
      noPhotoReason: "Storefront photo captured",
    });

    assert.equal(parsed.contactName, "Ramesh Patil");
    assert.equal("ownerName" in parsed, false);
  });
});
