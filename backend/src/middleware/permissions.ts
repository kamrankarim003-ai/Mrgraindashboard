import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ModuleName } from "../utils/permissionMatrix";

type Action = "view" | "create" | "edit" | "delete";

const ACTION_COLUMN: Record<Action, "canView" | "canCreate" | "canEdit" | "canDelete"> = {
  view: "canView",
  create: "canCreate",
  edit: "canEdit",
  delete: "canDelete",
};

export function requirePermission(moduleName: ModuleName, action: Action) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // Owner is always allowed - still verified against DB below in case seed data changes.
    const permission = await prisma.permission.findUnique({
      where: { roleId_moduleName: { roleId: req.user.roleId, moduleName } },
    });
    const column = ACTION_COLUMN[action];
    if (!permission || !permission[column]) {
      return res.status(403).json({
        error: `Your role (${req.user.roleName}) does not have '${action}' access to ${moduleName}`,
      });
    }
    next();
  };
}

export async function getPermissionsForRole(roleId: number) {
  const perms = await prisma.permission.findMany({ where: { roleId } });
  return perms.reduce<Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>>(
    (acc, p) => {
      acc[p.moduleName] = {
        view: p.canView,
        create: p.canCreate,
        edit: p.canEdit,
        delete: p.canDelete,
      };
      return acc;
    },
    {}
  );
}
