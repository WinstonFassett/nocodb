import { MetaTable } from '../../utils/globals';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.GROUP, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTable.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);

    table.string('fk_view_id', 20);
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);
    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('direction').defaultTo(false);

    table.float('order');
    table.timestamps(true, true);
  });
};

const down = async (knex) => {
    await knex.schema.dropTable(MetaTable.GROUP);
};

export { up, down };
