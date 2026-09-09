import {  int, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { roles, user } from "./user";
import { secureFields } from "./secureFields";
import { relations } from "drizzle-orm";

export const permissions = mysqlTable('permissions', {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 50 }).notNull().unique(),
    description: varchar('description', {length: 255}),
});

// 2. A join table to link roles to their permissions
export const rolePermissions = mysqlTable('role_permissions', {
    id: int('id').autoincrement().primaryKey(),
    roleId: int('role_id')
        .notNull()
        .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: int('permission_id')
        .notNull()
        .references(() => permissions.id, { onDelete: 'cascade' }),
    ...secureFields
});
    
export const specialPermissions = mysqlTable('special_permissions', {
    id: int('id').autoincrement().primaryKey(),
    userId: varchar('user_id', { length: 255 })
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    permissionId: int('permission_id')
        .notNull()
        .references(() => permissions.id, { onDelete: 'cascade' }),
    ...secureFields
});


export const rolesRelations = relations(roles, ({ many }) => ({
    rolePermissions: many(rolePermissions)
}));

// 4. Define relations for the new tables
export const permissionsRelations = relations(permissions, ({ many }) => ({
    rolePermissions: many(rolePermissions),
    specialPermissions: many(specialPermissions)
}));

export const specialPermissionsRelations = relations(specialPermissions, ({ one }) => ({
    user: one(user, {
        fields: [specialPermissions.userId],
        references: [user.id]
    }),
    permission: one(permissions, {
        fields: [specialPermissions.permissionId],
        references: [permissions.id]
    })
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
    role: one(roles, {
        fields: [rolePermissions.roleId],
        references: [roles.id]
    }),
    permission: one(permissions, {
        fields: [rolePermissions.permissionId],
        references: [permissions.id]
    })
}));