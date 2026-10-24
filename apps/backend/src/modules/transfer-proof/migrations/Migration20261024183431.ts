import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261024183431 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "transfer_proof" ("id" text not null, "order_id" text not null, "status" text check ("status" in ('pending_review', 'accepted', 'rejected')) not null default 'pending_review', "storage_key" text not null, "sha256" text not null, "mime" text not null, "size" integer not null, "rejection_reason" text null, "review_note" text null, "reviewed_by" text null, "reviewed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "transfer_proof_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_transfer_proof_deleted_at" ON "transfer_proof" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_transfer_proof_order_id" ON "transfer_proof" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_transfer_proof_sha256" ON "transfer_proof" ("sha256") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_transfer_proof_status" ON "transfer_proof" ("status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "transfer_proof" cascade;`);
  }

}
