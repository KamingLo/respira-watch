import type { Request, Response } from 'express';
import {
  createNewKelurahan,
  getKelurahans,
  getKelurahanDetailById,
  updateKelurahanById,
  deleteKelurahanById,
  type CreateKelurahanInput,
  type UpdateKelurahanInput,
} from '../services/kelurahanService.js';
import { Kelurahan } from '../models/Kelurahan.js';
import { handleControllerError, sendSuccess } from '../utils/response.js';

export const createKelurahan = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CreateKelurahanInput;
    const newKelurahan = await createNewKelurahan(body);

    sendSuccess(res, newKelurahan, 'Data kelurahan baru berhasil ditambahkan.', 201);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'KelurahanController.createKelurahan',
      'Gagal menambahkan data kelurahan baru.'
    );
  }
};

export const listKelurahans = async (req: Request, res: Response): Promise<void> => {
  try {
    const { kecamatan, kota, provinsi, baselineRiskLevel, search } = req.query as {
      kecamatan?: string;
      kota?: string;
      provinsi?: string;
      baselineRiskLevel?: string;
      search?: string;
    };

    const kelurahans = await getKelurahans({
      kecamatan,
      kota,
      provinsi,
      baselineRiskLevel,
      search,
    });

    sendSuccess(res, kelurahans, undefined, 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'KelurahanController.listKelurahans',
      'Gagal mengambil daftar kelurahan.'
    );
  }
};

export const listPublicKelurahans = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const kelurahans = await Kelurahan.find()
      .select('_id code name kecamatan centroid')
      .sort({ name: 1 })
      .lean();
    sendSuccess(
      res,
      kelurahans.map((kelurahan) => ({
        id: kelurahan._id.toString(),
        code: kelurahan.code,
        name: kelurahan.name,
        kecamatan: kelurahan.kecamatan,
        centroid: kelurahan.centroid,
      })),
      undefined,
      200
    );
  } catch (error) {
    handleControllerError(
      res,
      error,
      'KelurahanController.listPublicKelurahans',
      'Gagal mengambil pilihan kelurahan.'
    );
  }
};

export const getKelurahanById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const kelurahan = await getKelurahanDetailById(id);

    sendSuccess(res, kelurahan, undefined, 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'KelurahanController.getKelurahanById',
      'Gagal mengambil detail kelurahan.'
    );
  }
};

export const updateKelurahan = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const body = req.body as UpdateKelurahanInput;
    const updatedKelurahan = await updateKelurahanById(id, body);

    sendSuccess(res, updatedKelurahan, 'Data kelurahan berhasil diperbarui.', 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'KelurahanController.updateKelurahan',
      'Gagal memperbarui data kelurahan.'
    );
  }
};

export const deleteKelurahan = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const result = await deleteKelurahanById(id);

    sendSuccess(res, result, 'Data kelurahan berhasil dihapus.', 200);
  } catch (error) {
    handleControllerError(
      res,
      error,
      'KelurahanController.deleteKelurahan',
      'Gagal menghapus data kelurahan.'
    );
  }
};
