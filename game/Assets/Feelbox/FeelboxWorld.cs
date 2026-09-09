using UnityEngine;

public static class FeelboxWorld
{
    public static void Build(Transform parent)
    {
        var wall = Mat(new Color(0.42f, 0.41f, 0.36f));
        var floor = Mat(new Color(0.28f, 0.30f, 0.25f));
        var trim = Mat(new Color(0.35f, 0.34f, 0.30f));
        var crate = Mat(new Color(0.24f, 0.26f, 0.22f));

        Box(parent, new Vector3(4f, -0.05f, 0f), new Vector3(22f, 0.1f, 14f), floor);
        Box(parent, new Vector3(4f, 3.05f, 0f), new Vector3(22f, 0.1f, 14f), wall);

        Box(parent, new Vector3(-6.85f, 1.5f, 0f), new Vector3(0.3f, 3f, 14f), wall);
        Box(parent, new Vector3(14.85f, 1.5f, 0f), new Vector3(0.3f, 3f, 14f), wall);
        Box(parent, new Vector3(4f, 1.5f, -6.85f), new Vector3(22f, 3f, 0.3f), wall);
        Box(parent, new Vector3(4f, 1.5f, 6.85f), new Vector3(22f, 3f, 0.3f), wall);

        const float px = 2f;
        const float t = 0.3f;
        Box(parent, new Vector3(px, 1.5f, -3.275f), new Vector3(t, 3f, 5.45f), wall);
        Box(parent, new Vector3(px, 1.5f, 1.175f), new Vector3(t, 3f, 1.25f), wall);
        Box(parent, new Vector3(px, 0.525f, 2.5f), new Vector3(t, 1.05f, 1.4f), trim);
        Box(parent, new Vector3(px, 2.425f, 2.5f), new Vector3(t, 1.15f, 1.4f), wall);
        Box(parent, new Vector3(px, 1.5f, 4.9f), new Vector3(t, 3f, 3.4f), wall);
        Box(parent, new Vector3(px, 2.575f, 0f), new Vector3(t, 0.85f, 1.1f), wall);

        Box(parent, new Vector3(-2f, 0.4f, -4.2f), new Vector3(1.6f, 0.8f, 0.8f), crate);
        Box(parent, new Vector3(8.5f, 0.55f, 4.2f), new Vector3(2.2f, 1.1f, 1.1f), crate);

        var sun = new GameObject("Sun").AddComponent<Light>();
        sun.transform.SetParent(parent);
        sun.type = LightType.Directional;
        sun.transform.rotation = Quaternion.Euler(40f, -30f, 0f);
        sun.color = new Color(1f, 0.95f, 0.85f);
        sun.intensity = 1.1f;
        sun.shadows = LightShadows.Soft;
    }

    static void Box(Transform parent, Vector3 center, Vector3 size, Material mat)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
        go.name = "Box";
        go.transform.SetParent(parent, true);
        go.transform.SetPositionAndRotation(center, Quaternion.identity);
        go.transform.localScale = size;
        go.GetComponent<MeshRenderer>().sharedMaterial = mat;
    }

    static Material Mat(Color color)
    {
        var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
        var mat = new Material(shader) { color = color };
        return mat;
    }
}

public class FeelboxHit : MonoBehaviour
{
    public FeelboxDummy Dummy;
    public bool IsHead;
}

public class FeelboxDummy : MonoBehaviour
{
    public const int MaxHp = 100;
    public int Hp = MaxHp;

    float _deadAt = -1f;
    float _flashUntil;
    Vector3 _spawn;
    Material _bodyMat;
    Material _headMat;
    Color _bodyColor;
    Color _headColor;

    public static FeelboxDummy Spawn(Vector3 position, string name)
    {
        var root = new GameObject(name);
        root.transform.position = position;
        var dummy = root.AddComponent<FeelboxDummy>();

        var body = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        body.name = "Body";
        body.transform.SetParent(root.transform, false);
        body.transform.localPosition = new Vector3(0f, 0.9f, 0f);
        body.transform.localScale = new Vector3(0.7f, 0.9f, 0.7f);
        var bodyHit = body.AddComponent<FeelboxHit>();
        bodyHit.Dummy = dummy;
        dummy._bodyMat = Mat(new Color(0.42f, 0.29f, 0.20f));
        dummy._bodyColor = dummy._bodyMat.color;
        body.GetComponent<MeshRenderer>().sharedMaterial = dummy._bodyMat;

        var head = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        head.name = "Head";
        head.transform.SetParent(root.transform, false);
        head.transform.localPosition = new Vector3(0f, 1.74f, 0f);
        head.transform.localScale = Vector3.one * 0.5f;
        var headHit = head.AddComponent<FeelboxHit>();
        headHit.Dummy = dummy;
        headHit.IsHead = true;
        dummy._headMat = Mat(new Color(0.88f, 0.72f, 0.52f));
        dummy._headColor = dummy._headMat.color;
        head.GetComponent<MeshRenderer>().sharedMaterial = dummy._headMat;

        dummy._spawn = position;
        return dummy;
    }

    public void ApplyDamage(int amount, Vector3 dir)
    {
        if (Hp <= 0)
            return;
        Hp = Mathf.Max(0, Hp - amount);
        _flashUntil = Time.time + 0.09f;
        if (_bodyMat)
            _bodyMat.color = Color.white;
        if (_headMat)
            _headMat.color = amount >= FeelboxTune.DmgHead ? new Color(1f, 0.35f, 0.25f) : Color.white;
        transform.position += new Vector3(dir.x, 0f, dir.z).normalized * 0.04f;
        if (Hp <= 0)
        {
            _deadAt = Time.time;
            transform.rotation = Quaternion.Euler(80f, transform.eulerAngles.y, 0f);
            if (_bodyMat)
                _bodyMat.color = new Color(0.22f, 0.16f, 0.13f);
            if (_headMat)
                _headMat.color = new Color(0.35f, 0.18f, 0.14f);
        }
    }

    void Update()
    {
        if (Hp > 0 && Time.time > _flashUntil)
        {
            if (_bodyMat)
                _bodyMat.color = _bodyColor;
            if (_headMat)
                _headMat.color = _headColor;
        }
        if (Hp <= 0 && _deadAt > 0f && Time.time - _deadAt > 2.2f)
            ResetDummy();
    }

    void ResetDummy()
    {
        Hp = MaxHp;
        _deadAt = -1f;
        transform.SetPositionAndRotation(_spawn, Quaternion.identity);
        if (_bodyMat)
            _bodyMat.color = _bodyColor;
        if (_headMat)
            _headMat.color = _headColor;
    }

    static Material Mat(Color color)
    {
        var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
        return new Material(shader) { color = color };
    }
}

public static class FeelboxFx
{
    public static AudioClip Shot;
    public static AudioClip Dry;
    public static AudioClip Flesh;
    public static AudioClip Headshot;

    static Material _decalWorld;
    static Material _decalFlesh;
    static Material _decalHead;
    static Material _sparkHot;
    static Material _sparkBlood;
    static Material _tracerMat;
    static bool _warmed;

    public static void Warm()
    {
        if (_warmed)
            return;
        _warmed = true;
        Shot = Bang(220f, 0.11f, 0.9f);
        Dry = Bang(520f, 0.05f, 0.25f);
        Flesh = Bang(90f, 0.07f, 0.55f);
        Headshot = Bang(140f, 0.09f, 0.8f);
        _decalWorld = Unlit(new Color(0.12f, 0.11f, 0.09f));
        _decalFlesh = Unlit(new Color(0.55f, 0.08f, 0.07f));
        _decalHead = Unlit(new Color(0.72f, 0.05f, 0.05f));
        _sparkHot = Unlit(new Color(1f, 0.7f, 0.25f));
        _sparkBlood = Unlit(new Color(0.7f, 0.1f, 0.08f));
        var tracerShader = Shader.Find("Sprites/Default")
            ?? Shader.Find("Universal Render Pipeline/Unlit")
            ?? Shader.Find("Unlit/Color");
        _tracerMat = new Material(tracerShader) { color = new Color(1f, 0.88f, 0.4f, 1f) };
    }

    public static Material Lit(Color color)
    {
        var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
        return new Material(shader) { color = color };
    }

    public static Material Unlit(Color color)
    {
        var shader = Shader.Find("Universal Render Pipeline/Unlit")
            ?? Shader.Find("Unlit/Color")
            ?? Shader.Find("Sprites/Default")
            ?? Shader.Find("Universal Render Pipeline/Lit");
        var mat = new Material(shader) { color = color };
        return mat;
    }

    public static void Play(AudioSource src, AudioClip clip)
    {
        if (!src || !clip)
            return;
        src.pitch = Random.Range(0.92f, 1.08f);
        src.PlayOneShot(clip, 0.85f);
    }

    public static void Tracer(Vector3 from, Vector3 to)
    {
        Warm();
        var go = new GameObject("Tracer");
        var lr = go.AddComponent<LineRenderer>();
        lr.positionCount = 2;
        lr.SetPosition(0, from);
        lr.SetPosition(1, to);
        lr.startWidth = 0.018f;
        lr.endWidth = 0.006f;
        lr.material = _tracerMat;
        lr.startColor = new Color(1f, 0.9f, 0.4f, 1f);
        lr.endColor = new Color(1f, 0.7f, 0.2f, 0.2f);
        lr.numCapVertices = 2;
        lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        Object.Destroy(go, 0.05f);
    }

    public static void Impact(RaycastHit hit, bool flesh, bool head)
    {
        Warm();
        var mat = !flesh ? _decalWorld : head ? _decalHead : _decalFlesh;
        var size = flesh ? 0.13f : 0.09f;
        var decal = GameObject.CreatePrimitive(PrimitiveType.Quad);
        decal.name = "Impact";
        Object.Destroy(decal.GetComponent<Collider>());
        decal.GetComponent<MeshRenderer>().sharedMaterial = mat;
        decal.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        decal.transform.position = hit.point + hit.normal * 0.015f;
        decal.transform.rotation = Quaternion.LookRotation(-hit.normal);
        decal.transform.Rotate(0f, 0f, Random.Range(0f, 360f), Space.Self);
        decal.transform.localScale = new Vector3(size, size, 1f);
        decal.transform.SetParent(hit.collider.transform.root, true);
        Object.Destroy(decal, flesh ? 6f : 10f);

        var sparkMat = flesh ? _sparkBlood : _sparkHot;
        var count = flesh ? 7 : 5;
        for (var i = 0; i < count; i++)
        {
            var spark = GameObject.CreatePrimitive(PrimitiveType.Cube);
            spark.name = "Spark";
            Object.Destroy(spark.GetComponent<Collider>());
            spark.GetComponent<MeshRenderer>().sharedMaterial = sparkMat;
            spark.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            spark.transform.position = hit.point + hit.normal * 0.03f;
            spark.transform.localScale = Vector3.one * Random.Range(0.018f, 0.035f);
            var debris = spark.AddComponent<FeelboxDebris>();
            var spray = Vector3.Slerp(hit.normal, Random.onUnitSphere, 0.55f);
            debris.Vel = spray * Random.Range(2.2f, 5.5f);
            debris.Life = Random.Range(0.18f, 0.32f);
        }
    }

    static AudioClip Bang(float hz, float seconds, float gain)
    {
        const int sr = 22050;
        var n = Mathf.Max(64, (int)(sr * seconds));
        var data = new float[n];
        var phase = 0.0;
        for (var i = 0; i < n; i++)
        {
            var t = i / (float)sr;
            var env = Mathf.Exp(-t * (22f + hz * 0.04f));
            phase += (hz * (1.0 - t * 2.5) + 40.0) / sr;
            var thump = (float)System.Math.Sin(phase * System.Math.PI * 2.0);
            var noise = (Hash(i + (int)hz * 17) * 2f - 1f);
            data[i] = Mathf.Clamp((thump * 0.55f + noise * 0.45f) * env * gain, -1f, 1f);
        }
        var clip = AudioClip.Create("fx" + hz, n, 1, sr, false);
        clip.SetData(data, 0);
        return clip;
    }

    static float Hash(int n)
    {
        unchecked
        {
            n = (n << 13) ^ n;
            return 1f - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824f;
        }
    }
}

public class FeelboxDebris : MonoBehaviour
{
    public Vector3 Vel;
    public float Life = 0.25f;
    float _age;

    void Update()
    {
        _age += Time.deltaTime;
        Vel += Physics.gravity * Time.deltaTime;
        transform.position += Vel * Time.deltaTime;
        transform.Rotate(Vel.z * 80f, Vel.x * 80f, 0f);
        var u = 1f - _age / Life;
        transform.localScale = Vector3.one * Mathf.Max(0.001f, 0.03f * u);
        if (_age >= Life)
            Destroy(gameObject);
    }
}
