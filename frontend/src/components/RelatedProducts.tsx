import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardMedia, CardContent, Button, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../config/environment';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  salePrice?: number;
  images: string[];
  stock: number;
  category?: {
    id: string;
    name: string;
  };
}

interface RelatedProductsProps {
  productId: string;
  companyId: string;
  limit?: number;
}

const RelatedProducts: React.FC<RelatedProductsProps> = ({ productId, companyId, limit = 6 }) => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRelatedProducts();
  }, [productId, companyId]);

  const fetchRelatedProducts = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const response = await axios.get(
        `${apiUrl}/public/products/${productId}/related`,
        {
          params: { companyId, limit }
        }
      );

      if (response.data.success) {
        setProducts(response.data.data);
        console.log('✅ [RELATED-PRODUCTS] Loaded:', response.data.data.length);
      }
    } catch (error) {
      console.error('❌ [RELATED-PRODUCTS] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (id: string) => {
    navigate(`/shop/product/${id}?companyId=${companyId}`);
    window.scrollTo(0, 0);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0
    }).format(price);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 6 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        🔍 منتجات مشابهة
      </Typography>

      <Grid container spacing={3}>
        {products.map((product) => {
          const displayPrice = product.salePrice || product.price;
          const hasDiscount = product.salePrice && product.salePrice < product.price;

          return (
            <Grid item xs={12} sm={6} md={4} lg={2} key={product.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
                onClick={() => handleProductClick(product.id)}
              >
                <CardMedia
                  component="img"
                  height="200"
                  image={product.images[0] || '/placeholder.png'}
                  alt={product.name}
                  sx={{ objectFit: 'cover' }}
                />
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 'bold',
                      mb: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {product.name}
                  </Typography>

                  {product.category && (
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                      {product.category.name}
                    </Typography>
                  )}

                  <Box sx={{ mt: 'auto' }}>
                    {hasDiscount && (
                      <Typography
                        variant="body2"
                        sx={{
                          textDecoration: 'line-through',
                          color: 'text.secondary',
                          fontSize: '0.875rem'
                        }}
                      >
                        {formatPrice(product.price)}
                      </Typography>
                    )}
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 'bold',
                        color: hasDiscount ? 'error.main' : 'primary.main'
                      }}
                    >
                      {formatPrice(displayPrice)}
                    </Typography>
                  </Box>

                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{ mt: 2 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProductClick(product.id);
                    }}
                  >
                    عرض التفاصيل
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default RelatedProducts;
