import axios from 'axios';
import prisma from './prisma.js';
import redis from './redis.js';

interface ZaloApiClientOptions {
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  tokenExpiresAt: Date | number;
  oaId?: string;
  onTokenRefresh?: (tokens: { accessToken: string; refreshToken: string; expiresAt: Date }) => Promise<void>;
}

export class ZaloApiClient {
  private accessToken: string;
  private refreshToken: string;
  private tokenExpiresAt: number;
  private oaId?: string;
  private onTokenRefresh?: (tokens: { accessToken: string; refreshToken: string; expiresAt: Date }) => Promise<void>;

  constructor(options: ZaloApiClientOptions) {
    this.accessToken = options.encryptedAccessToken;
    this.refreshToken = options.encryptedRefreshToken;
    this.tokenExpiresAt = new Date(options.tokenExpiresAt).getTime();
    this.oaId = options.oaId;
    this.onTokenRefresh = options.onTokenRefresh;
  }

  private async ensureValidToken(): Promise<string> {
    const bufferTime = 5 * 60 * 1000; // 5 mins buffer
    const isExpired = Date.now() + bufferTime >= this.tokenExpiresAt;

    if (isExpired && this.onTokenRefresh) {
      console.log('[ZaloApiClient] Token đã hết hạn, bắt đầu refresh...');
      try {
        const response = await axios.post(
          'https://oauth.zaloapp.com/v4/oa/access_token',
          new URLSearchParams({
            refresh_token: this.refreshToken,
            grant_type: 'refresh_token',
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              secret_key: process.env.ZALO_APP_SECRET || '',
            },
          }
        );

        if (response.data && response.data.access_token) {
          const newAccessToken = response.data.access_token;
          const newRefreshToken = response.data.refresh_token || this.refreshToken;
          const expiresSeconds = parseInt(response.data.expires_in || '9000');
          const newExpiresAt = new Date(Date.now() + expiresSeconds * 1000);

          this.accessToken = newAccessToken;
          this.refreshToken = newRefreshToken;
          this.tokenExpiresAt = newExpiresAt.getTime();

          await this.onTokenRefresh({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresAt: newExpiresAt,
          });

          console.log('[ZaloApiClient] Refresh token Zalo OA thành công.');
        } else {
          throw new Error(JSON.stringify(response.data));
        }
      } catch (err: any) {
        console.error('[ZaloApiClient] Lỗi refresh token Zalo OA:', err.message || err);
      }
    }

    return this.accessToken;
  }

  async sendText(recipientId: string, text: string): Promise<any> {
    const token = await this.ensureValidToken();
    const endpoint = 'https://openapi.zalo.me/v3.0/oa/message/transaction';
    
    const response = await axios.post(
      endpoint,
      {
        recipient: {
          user_id: recipientId,
        },
        message: {
          text: text,
        },
      },
      {
        headers: {
          access_token: token,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.error !== 0) {
      throw new Error(`[Zalo OA Error] Code ${response.data.error}: ${response.data.message}`);
    }

    return response.data;
  }

  /**
   * Lấy profile chi tiết của Zalo OA user
   */
  async getUserProfile(userId: string): Promise<any> {
    const token = await this.ensureValidToken();
    const dataParam = JSON.stringify({ user_id: userId });
    const endpoint = `https://openapi.zalo.me/v3.0/oa/user/detail?data=${encodeURIComponent(dataParam)}`;
    
    const response = await axios.get(endpoint, {
      headers: {
        access_token: token,
      }
    });

    if (response.data && response.data.error !== 0) {
      throw new Error(`[Zalo OA Error] Code ${response.data.error}: ${response.data.message}`);
    }

    return response.data.data;
  }
}

/**
 * Lấy số điện thoại từ token (Mini App)
 */
export async function getPhoneNumberFromToken(token: string, userAccessToken: string): Promise<string | null> {
    const appSecret = process.env.ZALO_APP_SECRET;
    if (!appSecret) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[ZaloApi] CẢNH BÁO: ZALO_APP_SECRET trống trong môi trường development. Trả về số điện thoại mock để tiếp tục test trên thiết bị thật.');
            return '0908888999';
        }
        throw new Error('ZALO_APP_SECRET is required');
    }

    let url = `https://graph.zalo.me/v2.0/phone/token?code=${token}&access_token=${userAccessToken}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
        let response = await fetch(url, {
            method: 'GET',
            headers: {
                'secret_key': appSecret
            },
            signal: controller.signal
        });

        let data = await response.json() as any;

        if (data?.data?.number) return data.data.number;

        if (data.error === 404 || data.message?.includes('empty api')) {
            url = `https://graph.zalo.me/v2.0/me/info`;
            const controller2 = new AbortController();
            const timer2 = setTimeout(() => controller2.abort(), 5000);
            try {
                response = await fetch(url, {
                    headers: {
                        'access_token': userAccessToken,
                        'code': token,
                        'secret_key': appSecret
                    },
                    signal: controller2.signal
                });
                data = await response.json() as any;
                if (data?.data?.number) return data.data.number;
                if (data?.number) return data.number;
            } catch (err2: any) {
                if (err2.name === 'AbortError') {
                    throw new Error('ZALO_API_TIMEOUT');
                }
                throw err2;
            } finally {
                clearTimeout(timer2);
            }
        }

        return null;
    } catch (error: any) {
        if (error.name === 'AbortError' || error.message === 'ZALO_API_TIMEOUT') {
            throw new Error('ZALO_API_TIMEOUT');
        }
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Lấy thông tin chi tiết user từ AccessToken của Mini App
 */
export async function getUserInfoFromToken(userAccessToken: string): Promise<{ gender?: number; birthday?: string; name?: string; avatar?: string; idByOA?: string; user_id?: string } | null> {
    const appSecret = process.env.ZALO_APP_SECRET;
    if (!appSecret) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[ZaloApi] CẢNH BÁO: ZALO_APP_SECRET trống trong môi trường development. Trả về thông tin user mock để tiếp tục test trên thiết bị thật.');
            return {
                user_id: 'mock-zalo-user-id',
                name: 'Người Dùng Thử Nghiệm',
                avatar: 'https://zjs.zmdcdn.me/zmp-sdk/static/images/avatar.helper.png',
                gender: 1,
                birthday: '01/01/1995'
            };
        }
        throw new Error('ZALO_APP_SECRET is required');
    }

    const cacheKey = `zalo_verified_token:${userAccessToken}`;
    try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
    } catch (e) {
        console.error('[ZaloApi] Lỗi đọc cache từ Redis:', e);
    }

    const url = `https://graph.zalo.me/v2.0/me?fields=id,name,picture,gender,birthday,idByOA`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'secret_key': appSecret,
                'access_token': userAccessToken
            },
            signal: controller.signal
        });

        const data = await response.json() as any;

        if (data && !data.error) {
            const result: any = {};
            if (data.id) result.user_id = data.id;
            if (data.name) result.name = data.name;
            if (data.picture && data.picture.data && data.picture.data.url) result.avatar = data.picture.data.url;
            if (data.idByOA) result.idByOA = data.idByOA;

            if (data.gender !== undefined) {
                if (data.gender === 'male' || data.gender === 1) result.gender = 1;
                else if (data.gender === 'female' || data.gender === 0) result.gender = 0;
            }

            if (data.birthday) {
                if (data.birthday !== '01/01/1970') {
                    result.birthday = data.birthday;
                }
            }

            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
            } catch (e) {
                console.error('[ZaloApi] Lỗi lưu cache Redis:', e);
            }

            return result;
        }

        return null;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error('ZALO_API_TIMEOUT');
        }
        return null;
    } finally {
        clearTimeout(timer);
    }
}
