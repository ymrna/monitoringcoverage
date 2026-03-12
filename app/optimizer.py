import numpy as np
from sklearn.cluster import DBSCAN
from geopy.distance import geodesic

RADIUS_KM = 10

def refine_center(cluster):
    center = np.mean(cluster, axis=0)

    improved = True
    while improved:
        improved = False
        for p in cluster:
            if geodesic(center, p).km > RADIUS_KM:
                center = (center + p) / 2
                improved = True
    return center

def cluster_points(points):
    coords = np.array(points)

    kms_per_radian = 6371.0088
    epsilon = RADIUS_KM / kms_per_radian

    db = DBSCAN(eps=epsilon, min_samples=1, metric='haversine', algorithm='ball_tree')
    clusters = db.fit_predict(np.radians(coords))

    centers = []

    for cluster_id in set(clusters):
        cluster = coords[clusters == cluster_id]
        center = refine_center(cluster)
        centers.append(center.tolist())

    return centers
