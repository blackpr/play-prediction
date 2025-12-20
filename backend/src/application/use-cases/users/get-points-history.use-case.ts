import { PointGrantRepository, PointGrant } from '../../ports/repositories/point-grant.repository';

export interface GetPointsHistoryRequest {
  userId: string;
  page: number;
  pageSize: number;
}

export interface GetPointsHistoryResponse {
  items: (PointGrant & { grantedByEmail?: string })[];
  total: number;
}

export class GetPointsHistoryUseCase {
  private readonly pointGrantRepository: PointGrantRepository;

  constructor({ pointGrantRepository }: { pointGrantRepository: PointGrantRepository }) {
    this.pointGrantRepository = pointGrantRepository;
  }

  async execute(request: GetPointsHistoryRequest): Promise<GetPointsHistoryResponse> {
    const { userId, page, pageSize } = request;
    return this.pointGrantRepository.findByUserId(userId, { page, pageSize });
  }
}
