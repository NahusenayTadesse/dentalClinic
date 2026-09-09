import {  superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';


import { createRoleSchema as schema } from '$lib/ZodSchema';
import { db } from '$lib/server/db';
import { permissions} from '$lib/server/db/schema/';
import type { PageServerLoad } from './$types.js';



export const load: PageServerLoad = async () => {
  const form = await superValidate(zod4(schema));

  const allPermissions = await db.select({
      id: permissions.id,
      name: permissions.name,
      description: permissions.description
  }).from(permissions)

  return {
    form,
    allPermissions
  };
};