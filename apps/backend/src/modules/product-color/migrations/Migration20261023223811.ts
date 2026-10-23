import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261023223811 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "product_color" ("id" text not null, "hex" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_color_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_color_deleted_at" ON "product_color" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_color" cascade;`);
  }

}
