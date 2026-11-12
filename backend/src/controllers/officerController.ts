import type { Request, Response } from 'express';
import {
  createNewOfficer,
  getOfficers,
  getOfficerDetailById,
  updateOfficerById,
  assignOfficerKelurahan,
  deleteOfficerById,
  type CreateOfficerInput,
  type UpdateOfficerInput,
  type AssignOfficerKelurahanInput,
} from '../services/officerService.js';
import { handleControllerError, sendSuccess } from '../utils/response.js';

export const createOfficer = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CreateOfficerInput;
    const newOfficer = await createNewOfficer(body);

    sendSuccess(res, newOfficer, 'Petugas baru berhasil ditambahkan.', 201);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'OfficerController.createOfficer',
      'Gagal menambahkan petugas baru.'
    );
  }
};

export const listOfficers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, isActive, assignedKelurahan, search } = req.query as {
      role?: string;
      isActive?: string;
      assignedKelurahan?: string;
      search?: string;
    };

    const officers = await getOfficers({
      role,
      isActive,
      assignedKelurahan,
      search,
    });

    sendSuccess(res, officers, undefined, 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'OfficerController.listOfficers',
      'Gagal mengambil daftar petugas.'
    );
  }
};

export const getOfficerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const officer = await getOfficerDetailById(id);

    sendSuccess(res, officer, undefined, 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'OfficerController.getOfficerById',
      'Gagal mengambil detail petugas.'
    );
  }
};

export const updateOfficer = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const body = req.body as UpdateOfficerInput;
    const updatedOfficer = await updateOfficerById(id, body);

    sendSuccess(res, updatedOfficer, 'Data petugas berhasil diperbarui.', 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'OfficerController.updateOfficer',
      'Gagal memperbarui data petugas.'
    );
  }
};

export const assignKelurahanToOfficer = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const body = req.body as AssignOfficerKelurahanInput;
    const updatedOfficer = await assignOfficerKelurahan(id, body);

    const message = body.assignedKelurahan
      ? 'Kelurahan penempatan petugas berhasil diperbarui.'
      : 'Penempatan kelurahan petugas berhasil dilepas.';

    sendSuccess(res, updatedOfficer, message, 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'OfficerController.assignKelurahanToOfficer',
      'Gagal memperbarui penempatan kelurahan petugas.'
    );
  }
};

export const deleteOfficer = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const requesterId = req.officer?.officerId;
    const result = await deleteOfficerById(id, requesterId);

    sendSuccess(res, result, 'Data petugas berhasil dihapus.', 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'OfficerController.deleteOfficer',
      'Gagal menghapus data petugas.'
    );
  }
};
