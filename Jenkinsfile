def name = 'pos-cli'

pipeline {
  agent any

  environment {
    MPKIT_TOKEN = credentials('MPKIT_TOKEN')
    MPKIT_EMAIL = "darek+ci@near-me.com"
    MPKIT_URL = "https://qa-17263.staging.oregon.platform-os.com"
    POS_PORTAL_PASSWORD = credentials('POS_PORTAL_PASSWORD')
  }

  stages {
    stage('Test latest package 20-alpine') {
      agent { kubernetes { yaml podTemplate("amd64", "20-alpine") } }

      steps {
        container(name: 'node') {
          sh 'set -e'
          sh 'npm install -g @platformos/pos-cli'
          sh 'pos-cli env list'
        }
      }
    }
  }
}

def podTemplate(arch, nodeversion) {
  return """
        spec:
          nodeSelector:
            beta.kubernetes.io/arch: ${arch}
          containers:
          - name: node
            resources:
              limits:
                cpu: 1
                memory: 1Gi
              requests:
                cpu: 1
                memory: 1Gi
            image: "node:${nodeversion}"
            imagePullPolicy: IfNotPresent
            command:
            - cat
            tty: true
"""
}
